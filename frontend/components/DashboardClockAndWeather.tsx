"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Clock,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Wind,
  Navigation,
  MapPin,
  RefreshCw,
  ChevronDown,
  Palette,
  Search,
  History,
  X,
  Globe,
  Compass,
  Check,
  Building2,
} from "lucide-react";

export type ClockDesign = "digital" | "analog" | "flip" | "world";

export interface TimezoneOption {
  id: string;
  label: string;
  city: string;
  country: string;
  flag: string;
  timeZone: string; // IANA timezone or "local"
}

export const WORLD_TIMEZONES: TimezoneOption[] = [
  { id: "local", label: "Local Device Time", city: "Local Device", country: "Your Location", flag: "📍", timeZone: "local" },
  { id: "helsinki", label: "Helsinki HQ", city: "Helsinki", country: "Finland", flag: "🇫🇮", timeZone: "Europe/Helsinki" },
  { id: "tampere", label: "Tampere Plant", city: "Tampere", country: "Finland", flag: "🇫🇮", timeZone: "Europe/Helsinki" },
  { id: "london", label: "London Hub", city: "London", country: "United Kingdom", flag: "🇬🇧", timeZone: "Europe/London" },
  { id: "newyork", label: "New York", city: "New York", country: "United States", flag: "🇺🇸", timeZone: "America/New_York" },
  { id: "dubai", label: "Dubai", city: "Dubai", country: "UAE", flag: "🇦🇪", timeZone: "Asia/Dubai" },
  { id: "singapore", label: "Singapore", city: "Singapore", country: "Singapore", flag: "🇸🇬", timeZone: "Asia/Singapore" },
  { id: "tokyo", label: "Tokyo", city: "Tokyo", country: "Japan", flag: "🇯🇵", timeZone: "Asia/Tokyo" },
  { id: "india", label: "India (IST)", city: "New Delhi", country: "India", flag: "🇮🇳", timeZone: "Asia/Kolkata" },
];

export interface RecentLocation {
  name: string;
  admin?: string;
  country: string;
  countryCode?: string;
  lat: number;
  lon: number;
  searchedAt: number;
}

interface WeatherState {
  temperature: number;
  weatherCode: number;
  conditionText: string;
  windSpeed: number;
  isDay: boolean;
  locationName: string;
  countryName?: string;
  isAutoDetected: boolean;
  lastUpdated: string;
}

interface GeocodingResultItem {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
}

const DEFAULT_INITIAL_RECENTS: RecentLocation[] = [
  { name: "Helsinki", admin: "Uusimaa", country: "Finland", countryCode: "FI", lat: 60.1695, lon: 24.9354, searchedAt: Date.now() - 10000 },
  { name: "Tampere", admin: "Pirkanmaa", country: "Finland", countryCode: "FI", lat: 61.4978, lon: 23.7610, searchedAt: Date.now() - 20000 },
  { name: "Espoo", admin: "Uusimaa", country: "Finland", countryCode: "FI", lat: 60.2055, lon: 24.6559, searchedAt: Date.now() - 30000 },
];

export const DashboardClockAndWeather: React.FC = () => {
  // ---------------- CLOCK STATE ----------------
  const [now, setNow] = useState<Date | null>(null);
  const [clockDesign, setClockDesign] = useState<ClockDesign>("digital");
  const [selectedTimezone, setSelectedTimezone] = useState<string>("local");
  const [isClockMenuOpen, setIsClockMenuOpen] = useState(false);
  const clockMenuRef = useRef<HTMLDivElement>(null);

  // ---------------- WEATHER STATE ----------------
  const [weather, setWeather] = useState<WeatherState>({
    temperature: 0,
    weatherCode: 0,
    conditionText: "Loading...",
    windSpeed: 0,
    isDay: true,
    locationName: "Locating...",
    countryName: "",
    isAutoDetected: true,
    lastUpdated: "--:--",
  });
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [isWeatherMenuOpen, setIsWeatherMenuOpen] = useState(false);
  const weatherMenuRef = useRef<HTMLDivElement>(null);

  // Search & Recents
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ---------------- CLOCK TICK & PERSISTENCE ----------------
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 1000);

    const savedDesign = localStorage.getItem("dashboard_clock_design") as ClockDesign | null;
    if (savedDesign && ["digital", "analog", "flip", "world"].includes(savedDesign)) {
      setClockDesign(savedDesign);
    }

    const savedTz = localStorage.getItem("dashboard_clock_timezone");
    if (savedTz) {
      setSelectedTimezone(savedTz);
    }

    // Load recent locations
    try {
      const savedRecents = localStorage.getItem("dashboard_weather_recents");
      if (savedRecents) {
        const parsed = JSON.parse(savedRecents);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentLocations(parsed.slice(0, 5));
        } else {
          setRecentLocations(DEFAULT_INITIAL_RECENTS);
        }
      } else {
        setRecentLocations(DEFAULT_INITIAL_RECENTS);
      }
    } catch {
      setRecentLocations(DEFAULT_INITIAL_RECENTS);
    }

    return () => clearInterval(interval);
  }, []);

  // ---------------- CLOSE MENUS ON OUTSIDE CLICK ----------------
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (clockMenuRef.current && !clockMenuRef.current.contains(e.target as Node)) {
        setIsClockMenuOpen(false);
      }
      if (weatherMenuRef.current && !weatherMenuRef.current.contains(e.target as Node)) {
        setIsWeatherMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // ---------------- WEATHER HELPERS ----------------
  const parseWmoWeather = (code: number): { text: string; Icon: React.ElementType; color: string; bgTint: string } => {
    if (code === 0) return { text: "Clear Sky", Icon: Sun, color: "text-amber-500", bgTint: "bg-amber-500/10 border-amber-500/20" };
    if ([1, 2].includes(code)) return { text: "Partly Cloudy", Icon: Cloud, color: "text-sky-500", bgTint: "bg-sky-500/10 border-sky-500/20" };
    if (code === 3) return { text: "Overcast", Icon: Cloud, color: "text-slate-400", bgTint: "bg-slate-500/10 border-slate-500/20" };
    if ([45, 48].includes(code)) return { text: "Fog / Mist", Icon: CloudFog, color: "text-indigo-400", bgTint: "bg-indigo-500/10 border-indigo-500/20" };
    if ([51, 53, 55].includes(code)) return { text: "Light Drizzle", Icon: CloudRain, color: "text-blue-400", bgTint: "bg-blue-500/10 border-blue-500/20" };
    if ([61, 63, 65].includes(code)) return { text: "Rain", Icon: CloudRain, color: "text-blue-500", bgTint: "bg-blue-500/10 border-blue-500/20" };
    if ([71, 73, 75, 77].includes(code)) return { text: "Snowfall", Icon: CloudSnow, color: "text-cyan-400", bgTint: "bg-cyan-500/10 border-cyan-500/20" };
    if ([80, 81, 82].includes(code)) return { text: "Rain Showers", Icon: CloudRain, color: "text-blue-600", bgTint: "bg-blue-600/10 border-blue-600/20" };
    if ([85, 86].includes(code)) return { text: "Snow Showers", Icon: CloudSnow, color: "text-cyan-500", bgTint: "bg-cyan-500/10 border-cyan-500/20" };
    if ([95, 96, 99].includes(code)) return { text: "Thunderstorm", Icon: CloudLightning, color: "text-amber-600", bgTint: "bg-amber-600/10 border-amber-600/20" };
    return { text: "Cloudy", Icon: Cloud, color: "text-slate-400", bgTint: "bg-slate-500/10 border-slate-500/20" };
  };

  const fetchWeather = useCallback(
    async (lat: number, lon: number, cityName: string, countryName: string = "", isAuto: boolean = false) => {
      setIsWeatherLoading(true);
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const curr = data.current_weather;
          const parsed = parseWmoWeather(curr.weathercode);

          setWeather({
            temperature: Math.round(curr.temperature * 10) / 10,
            weatherCode: curr.weathercode,
            conditionText: parsed.text,
            windSpeed: Math.round(curr.windspeed),
            isDay: Boolean(curr.is_day),
            locationName: cityName,
            countryName: countryName,
            isAutoDetected: isAuto,
            lastUpdated: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
          });

          // Save current weather location coordinates
          localStorage.setItem("dashboard_weather_lat", lat.toString());
          localStorage.setItem("dashboard_weather_lon", lon.toString());
          localStorage.setItem("dashboard_weather_city", cityName);
          localStorage.setItem("dashboard_weather_country", countryName);
          localStorage.setItem("dashboard_weather_auto", isAuto ? "1" : "0");
        }
      } catch (err) {
        console.error("Failed to fetch weather:", err);
      } finally {
        setIsWeatherLoading(false);
      }
    },
    []
  );

  // ---------------- ADD TO RECENTS (MAX 5) ----------------
  const saveToRecents = useCallback((loc: RecentLocation) => {
    setRecentLocations((prev) => {
      const filtered = prev.filter(
        (item) => item.name.toLowerCase() !== loc.name.toLowerCase() || Math.abs(item.lat - loc.lat) > 0.05
      );
      const updated = [loc, ...filtered].slice(0, 5);
      localStorage.setItem("dashboard_weather_recents", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFromRecents = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setRecentLocations((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      localStorage.setItem("dashboard_weather_recents", JSON.stringify(updated));
      return updated;
    });
  };

  // ---------------- DEFAULT CURRENT LOCATION AUTO-FETCH ----------------
  const fetchCurrentGpsLocation = useCallback(() => {
    if (!navigator.geolocation) {
      // Fallback to Tampere/Helsinki if browser geolocation unsupported
      fetchWeather(60.1695, 24.9354, "Helsinki", "Finland", false);
      return;
    }

    setIsWeatherLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let detectedCity = "Current Location";
        let detectedCountry = "";

        try {
          // Free reverse geocoding to retrieve actual city name (e.g. Raipur, Helsinki, etc.)
          const revRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          if (revRes.ok) {
            const revData = await revRes.json();
            detectedCity = revData.city || revData.locality || revData.principalSubdivision || "Current Location";
            detectedCountry = revData.countryName || "";
          }
        } catch {
          // Use coordinate fallback
        }

        fetchWeather(latitude, longitude, detectedCity, detectedCountry, true);
        saveToRecents({
          name: detectedCity,
          country: detectedCountry,
          lat: latitude,
          lon: longitude,
          searchedAt: Date.now(),
        });
      },
      () => {
        // If user denied permission or error, load saved location or Helsinki fallback
        const savedCity = localStorage.getItem("dashboard_weather_city");
        const savedLat = localStorage.getItem("dashboard_weather_lat");
        const savedLon = localStorage.getItem("dashboard_weather_lon");
        const savedCountry = localStorage.getItem("dashboard_weather_country") || "";

        if (savedLat && savedLon && savedCity) {
          fetchWeather(parseFloat(savedLat), parseFloat(savedLon), savedCity, savedCountry, false);
        } else {
          fetchWeather(60.1695, 24.9354, "Helsinki", "Finland", false);
        }
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, [fetchWeather, saveToRecents]);

  // Load current location by default on initial mount
  useEffect(() => {
    const savedAuto = localStorage.getItem("dashboard_weather_auto");
    const savedCity = localStorage.getItem("dashboard_weather_city");
    const savedLat = localStorage.getItem("dashboard_weather_lat");
    const savedLon = localStorage.getItem("dashboard_weather_lon");
    const savedCountry = localStorage.getItem("dashboard_weather_country") || "";

    // If user has not explicitly locked a manual city search, or asked for auto, or fresh start: auto fetch!
    if (!savedCity || savedAuto === "1") {
      fetchCurrentGpsLocation();
    } else if (savedLat && savedLon) {
      fetchWeather(parseFloat(savedLat), parseFloat(savedLon), savedCity, savedCountry, false);
    } else {
      fetchCurrentGpsLocation();
    }
  }, [fetchCurrentGpsLocation, fetchWeather]);

  // ---------------- SEARCH CITY AUTOCOMPLETE ----------------
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const delayTimer = setTimeout(async () => {
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          searchQuery.trim()
        )}&count=6&language=en&format=json`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(delayTimer);
  }, [searchQuery]);

  const handleSelectSearchResult = (item: GeocodingResultItem) => {
    const cityName = item.name;
    const countryName = item.country || "";
    fetchWeather(item.latitude, item.longitude, cityName, countryName, false);
    saveToRecents({
      name: cityName,
      admin: item.admin1,
      country: countryName,
      countryCode: item.country_code,
      lat: item.latitude,
      lon: item.longitude,
      searchedAt: Date.now(),
    });
    setSearchQuery("");
    setSearchResults([]);
    setIsWeatherMenuOpen(false);
  };

  const handleSelectRecent = (recent: RecentLocation) => {
    fetchWeather(recent.lat, recent.lon, recent.name, recent.country, false);
    // Move to front of recents
    saveToRecents({ ...recent, searchedAt: Date.now() });
    setIsWeatherMenuOpen(false);
  };

  // ---------------- CLOCK FORMATTERS ----------------
  const activeTzConfig = WORLD_TIMEZONES.find((t) => t.id === selectedTimezone) || WORLD_TIMEZONES[0];

  const getTzDate = useCallback(
    (timeZone: string) => {
      if (!now) return new Date();
      if (timeZone === "local") return now;
      try {
        const str = now.toLocaleString("en-US", { timeZone });
        return new Date(str);
      } catch {
        return now;
      }
    },
    [now]
  );

  const displayDate = now ? getTzDate(activeTzConfig.timeZone) : new Date();
  const helsinkiDate = now ? getTzDate("Europe/Helsinki") : new Date();

  const hours = displayDate.getHours();
  const minutes = displayDate.getMinutes();
  const seconds = displayDate.getSeconds();

  const pad = (n: number) => n.toString().padStart(2, "0");
  const formattedHours = pad(hours);
  const formattedMinutes = pad(minutes);
  const formattedSeconds = pad(seconds);
  const formattedDay = displayDate.toLocaleDateString("en-GB", { weekday: "short" });
  const formattedDate = displayDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  // Clock Hand Angles for Analog
  const secondDeg = seconds * 6;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = (hours % 12) * 30 + minutes * 0.5;

  const weatherVisual = parseWmoWeather(weather.weatherCode);
  const WeatherIcon = weatherVisual.Icon;

  return (
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
      {/* =========================================================================
          1. WEATHER WIDGET (Executive Card with Search & Recents)
          ========================================================================= */}
      <div className="relative" ref={weatherMenuRef}>
        <button
          type="button"
          onClick={() => {
            setIsWeatherMenuOpen((prev) => !prev);
            setIsClockMenuOpen(false);
            setTimeout(() => searchInputRef.current?.focus(), 150);
          }}
          className={`flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/40 shadow-xs hover:shadow-md transition-all cursor-pointer group select-none text-left ${
            isWeatherMenuOpen ? "ring-2 ring-[var(--accent-color)]/20 border-[var(--accent-color)]" : ""
          }`}
          title="Click to search any city, view recent locations, or auto-detect GPS"
        >
          {/* Weather Icon Badge */}
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-200 group-hover:scale-105 ${weatherVisual.bgTint}`}
          >
            <WeatherIcon className={`w-5 h-5 ${weatherVisual.color} ${isWeatherLoading ? "animate-pulse" : ""}`} />
          </div>

          {/* Temperature & Details */}
          <div className="min-w-0 pr-1">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-base sm:text-lg font-black tracking-tight text-[var(--text-primary)]">
                {weather.temperature > 0 ? `+${weather.temperature}` : weather.temperature}°C
              </span>
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] truncate max-w-[90px] sm:max-w-[110px]">
                {weather.conditionText}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] mt-1 leading-none">
              <span className="inline-flex items-center gap-0.5 font-bold text-[var(--text-primary)] max-w-[100px] truncate">
                {weather.isAutoDetected ? (
                  <Navigation className="w-2.5 h-2.5 text-emerald-500 fill-emerald-500 shrink-0" />
                ) : (
                  <MapPin className="w-2.5 h-2.5 text-[var(--accent-color)] shrink-0" />
                )}
                <span>{weather.locationName}</span>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-0.5">
                <Wind className="w-2.5 h-2.5 opacity-70" />
                <span>{weather.windSpeed} km/h</span>
              </span>
            </div>
          </div>

          <ChevronDown
            className={`w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0 transition-transform duration-200 ${
              isWeatherMenuOpen ? "rotate-180 text-[var(--accent-color)]" : ""
            }`}
          />
        </button>

        {/* WEATHER DROPDOWN: REAL-TIME SEARCH + LAST 5 RECENTS + GPS AUTO */}
        {isWeatherMenuOpen && (
          <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-2 w-[calc(100vw-2rem)] sm:w-88 max-w-sm rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
            {/* Header + GPS Button */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <div className="text-xs font-black uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                <span>Weather Location</span>
              </div>
              <button
                type="button"
                onClick={fetchCurrentGpsLocation}
                disabled={isWeatherLoading}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 transition-all cursor-pointer"
                title="Detect your device GPS coordinates"
              >
                <Navigation className={`w-3 h-3 ${isWeatherLoading ? "animate-spin" : ""}`} />
                <span>Auto GPS</span>
              </button>
            </div>

            {/* Real-time Location Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any world city (e.g. London, Helsinki)..."
                className="w-full pl-8.5 pr-8 py-2 rounded-xl text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] focus:border-[var(--accent-color)] focus:ring-1 focus:ring-[var(--accent-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)]/70 transition-all outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--border-color)] text-[var(--text-secondary)]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Instant Search Results Dropdown List */}
            {searchQuery.trim().length >= 2 && (
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] overflow-hidden divide-y divide-[var(--border-color)] max-h-48 overflow-y-auto">
                {isSearching ? (
                  <div className="p-3 text-center text-xs text-[var(--text-secondary)] flex items-center justify-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin text-[var(--accent-color)]" />
                    <span>Searching locations...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectSearchResult(item)}
                      className="w-full px-3 py-2 text-left hover:bg-[var(--accent-color)]/10 hover:text-[var(--accent-color)] transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-color)] truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)] truncate">
                          {[item.admin1, item.country].filter(Boolean).join(", ")}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] shrink-0">
                        Select
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-[var(--text-secondary)]">
                    No matching cities found. Try another spelling.
                  </div>
                )}
              </div>
            )}

            {/* Last 5 Searched / Recent Locations */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 px-1">
                <span className="flex items-center gap-1">
                  <History className="w-3 h-3" />
                  <span>Recent Locations (Last 5)</span>
                </span>
                <span className="text-[9px] text-[var(--text-secondary)]/70">Click to switch</span>
              </div>

              {recentLocations.length === 0 ? (
                <div className="text-xs text-[var(--text-secondary)] p-2 text-center bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)]">
                  No recent searches yet. Search any city above!
                </div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {recentLocations.map((loc, idx) => {
                    const isCurrent =
                      weather.locationName.toLowerCase() === loc.name.toLowerCase() && !weather.isAutoDetected;
                    return (
                      <div
                        key={`${loc.name}-${loc.lat}-${idx}`}
                        onClick={() => handleSelectRecent(loc)}
                        className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer group ${
                          isCurrent
                            ? "bg-[var(--accent-color)] text-white font-bold shadow-xs"
                            : "hover:bg-[var(--bg-primary)] text-[var(--text-primary)] border border-transparent hover:border-[var(--border-color)]"
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <MapPin
                            className={`w-3 h-3 shrink-0 ${
                              isCurrent ? "text-white" : "text-[var(--text-secondary)] group-hover:text-[var(--accent-color)]"
                            }`}
                          />
                          <div className="truncate">
                            <span className="text-xs font-bold">{loc.name}</span>
                            {loc.country && (
                              <span
                                className={`text-[10px] ml-1.5 ${
                                  isCurrent ? "text-white/80" : "text-[var(--text-secondary)]"
                                }`}
                              >
                                {loc.country}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isCurrent && <Check className="w-3 h-3 text-white" />}
                          <button
                            type="button"
                            onClick={(e) => removeFromRecents(e, idx)}
                            className={`p-1 rounded-full opacity-60 hover:opacity-100 transition-opacity ${
                              isCurrent ? "hover:bg-white/20 text-white" : "hover:bg-[var(--border-color)] text-[var(--text-secondary)]"
                            }`}
                            title="Remove from recents"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer with status */}
            <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
              <span>Updated: {weather.lastUpdated}</span>
              <button
                type="button"
                onClick={() => {
                  const lat = localStorage.getItem("dashboard_weather_lat");
                  const lon = localStorage.getItem("dashboard_weather_lon");
                  const city = localStorage.getItem("dashboard_weather_city") || "Tampere";
                  const country = localStorage.getItem("dashboard_weather_country") || "";
                  const isAuto = localStorage.getItem("dashboard_weather_auto") === "1";
                  if (lat && lon) {
                    fetchWeather(parseFloat(lat), parseFloat(lon), city, country, isAuto);
                  } else {
                    fetchCurrentGpsLocation();
                  }
                }}
                className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] font-semibold"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isWeatherLoading ? "animate-spin" : ""}`} />
                <span>Refresh Weather</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. CLOCK WIDGET (Modern Digital, Analog Dial, Split Cards, World Clock)
          ========================================================================= */}
      <div className="relative" ref={clockMenuRef}>
        {/* DESIGN 1: MODERN DIGITAL PRO */}
        {clockDesign === "digital" && (
          <div
            onClick={() => setIsClockMenuOpen((prev) => !prev)}
            className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/40 shadow-xs hover:shadow-md transition-all cursor-pointer group select-none"
            title="Click to customize Clock Design or World Timezone"
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)] text-[var(--accent-color)] border border-[var(--accent-color)]/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-baseline gap-1 font-mono tracking-tight font-black text-[var(--text-primary)] leading-none text-base sm:text-lg">
                <span>{formattedHours}</span>
                <span className="text-[var(--accent-color)] animate-pulse">:</span>
                <span>{formattedMinutes}</span>
                <span className="text-[var(--accent-color)] animate-pulse">:</span>
                <span className="text-xs sm:text-sm font-semibold opacity-75">{formattedSeconds}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-medium mt-1 leading-none">
                <span className="font-bold text-[var(--text-primary)]">{formattedDay}, {formattedDate}</span>
                <span>•</span>
                <span className="px-1 py-0.2 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[9px] font-bold">
                  {activeTzConfig.flag} {activeTzConfig.city}
                </span>
              </div>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0 transition-transform ${
                isClockMenuOpen ? "rotate-180 text-[var(--accent-color)]" : ""
              }`}
            />
          </div>
        )}

        {/* DESIGN 2: NORDIC ANALOG DIAL */}
        {clockDesign === "analog" && (
          <div
            onClick={() => setIsClockMenuOpen((prev) => !prev)}
            className="flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/40 shadow-xs hover:shadow-md transition-all cursor-pointer group select-none"
            title="Click to customize Clock Design or World Timezone"
          >
            {/* Analog Face (52px) */}
            <div className="relative w-11 h-11 rounded-full bg-[var(--bg-card)] border-2 border-[var(--border-color)] shadow-inner flex items-center justify-center shrink-0 group-hover:border-[var(--accent-color)] transition-colors">
              {/* Dial Marks */}
              <div className="absolute top-0.5 w-0.5 h-1 bg-[var(--text-primary)] opacity-80" />
              <div className="absolute bottom-0.5 w-0.5 h-1 bg-[var(--text-primary)] opacity-80" />
              <div className="absolute left-0.5 w-1 h-0.5 bg-[var(--text-primary)] opacity-80" />
              <div className="absolute right-0.5 w-1 h-0.5 bg-[var(--text-primary)] opacity-80" />

              {/* Center Pivot */}
              <div className="absolute w-2 h-2 rounded-full bg-[var(--accent-color)] z-30 shadow-xs" />

              {/* Hour Hand */}
              <div
                className="absolute w-1 h-3.5 bg-[var(--text-primary)] rounded-full origin-bottom z-10"
                style={{
                  bottom: "50%",
                  transform: `rotate(${hourDeg}deg)`,
                  transition: "transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)",
                }}
              />

              {/* Minute Hand */}
              <div
                className="absolute w-0.5 h-4.5 bg-[var(--text-primary)] opacity-90 rounded-full origin-bottom z-20"
                style={{
                  bottom: "50%",
                  transform: `rotate(${minuteDeg}deg)`,
                  transition: "transform 0.2s cubic-bezier(0.4, 2.08, 0.55, 0.44)",
                }}
              />

              {/* Second Hand (Orange / Accent) */}
              <div
                className="absolute w-0.5 h-5 bg-amber-500 rounded-full origin-bottom z-25"
                style={{
                  bottom: "50%",
                  transform: `rotate(${secondDeg}deg)`,
                }}
              />
            </div>

            {/* Companion Digital Time */}
            <div>
              <div className="font-mono font-black text-sm sm:text-base text-[var(--text-primary)] leading-none tracking-tight">
                {formattedHours}:{formattedMinutes}:{formattedSeconds}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] font-medium mt-1 leading-none flex items-center gap-1">
                <span>{formattedDay}, {formattedDate}</span>
                <span>•</span>
                <span className="font-bold text-[var(--text-primary)]">{activeTzConfig.city}</span>
              </div>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0 transition-transform ${
                isClockMenuOpen ? "rotate-180 text-[var(--accent-color)]" : ""
              }`}
            />
          </div>
        )}

        {/* DESIGN 3: EXECUTIVE SPLIT CARDS */}
        {clockDesign === "flip" && (
          <div
            onClick={() => setIsClockMenuOpen((prev) => !prev)}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/40 shadow-xs hover:shadow-md transition-all cursor-pointer group select-none"
            title="Click to customize Clock Design or World Timezone"
          >
            {/* Split Hour Card */}
            <div className="px-2 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-800 shadow-sm font-mono font-black text-sm sm:text-base tracking-wider relative border border-slate-700/50">
              <span>{formattedHours}</span>
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/40" />
            </div>

            <span className="text-[var(--accent-color)] font-mono font-black text-base animate-pulse">:</span>

            {/* Split Minute Card */}
            <div className="px-2 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-800 shadow-sm font-mono font-black text-sm sm:text-base tracking-wider relative border border-slate-700/50">
              <span>{formattedMinutes}</span>
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/40" />
            </div>

            <span className="text-[var(--accent-color)] font-mono font-black text-base animate-pulse">:</span>

            {/* Split Second Card (Vibrant Accent Glow) */}
            <div className="px-1.5 py-1 rounded-lg bg-[var(--accent-color)] text-white shadow-sm font-mono font-black text-xs sm:text-sm tracking-wider relative">
              <span>{formattedSeconds}</span>
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/20" />
            </div>

            <div className="text-[10px] text-[var(--text-secondary)] ml-1 font-bold">
              <div>{formattedDay}</div>
              <div className="text-[9px] opacity-75">{activeTzConfig.flag}</div>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0 transition-transform ${
                isClockMenuOpen ? "rotate-180 text-[var(--accent-color)]" : ""
              }`}
            />
          </div>
        )}

        {/* DESIGN 4: WORLD CLOCK DUAL (Local Time + Helsinki Finland HQ) */}
        {clockDesign === "world" && (
          <div
            onClick={() => setIsClockMenuOpen((prev) => !prev)}
            className="flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--accent-color)]/40 shadow-xs hover:shadow-md transition-all cursor-pointer group select-none"
            title="World Clock Mode: Showing Local Time & Helsinki HQ Time"
          >
            {/* Primary Display */}
            <div className="border-r border-[var(--border-color)] pr-3">
              <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                <span>{activeTzConfig.flag}</span>
                <span>{activeTzConfig.city}</span>
              </div>
              <div className="font-mono font-black text-base text-[var(--text-primary)] leading-tight">
                {formattedHours}:{formattedMinutes}
                <span className="text-xs font-normal opacity-70 ml-0.5">:{formattedSeconds}</span>
              </div>
            </div>

            {/* Helsinki HQ Anchor */}
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                <span>🇫🇮</span>
                <span>Helsinki HQ</span>
              </div>
              <div className="font-mono font-bold text-sm text-[var(--text-primary)] leading-tight">
                {pad(helsinkiDate.getHours())}:{pad(helsinkiDate.getMinutes())}
                <span className="text-[10px] font-normal text-[var(--text-secondary)] ml-1">EET</span>
              </div>
            </div>

            <ChevronDown
              className={`w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0 transition-transform ${
                isClockMenuOpen ? "rotate-180 text-[var(--accent-color)]" : ""
              }`}
            />
          </div>
        )}

        {/* CLOCK SETTINGS & WORLD CLOCK DROPDOWN */}
        {isClockMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl z-50 p-3 space-y-3 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md">
            {/* Section 1: Choose Clock Design */}
            <div>
              <div className="px-1 text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[var(--accent-color)]" />
                  <span>Clock Face Design</span>
                </span>
                <span className="text-[9px] text-[var(--text-secondary)]/70">Select style</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "digital", label: "Modern Digital", desc: "Monospace glow" },
                  { id: "world", label: "World Clock", desc: "Dual timezones" },
                  { id: "analog", label: "Nordic Watch", desc: "Analog ticking dial" },
                  { id: "flip", label: "Split Cards", desc: "Executive flip cards" },
                ].map((d) => {
                  const isSelected = clockDesign === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setClockDesign(d.id as ClockDesign);
                        localStorage.setItem("dashboard_clock_design", d.id);
                      }}
                      className={`p-2 rounded-xl text-left transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-[var(--accent-color)] text-white font-bold border-transparent shadow-xs"
                          : "bg-[var(--bg-primary)] hover:border-[var(--accent-color)]/50 text-[var(--text-primary)] border-[var(--border-color)]"
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight">{d.label}</div>
                      <div className={`text-[10px] mt-0.5 ${isSelected ? "text-white/80" : "text-[var(--text-secondary)]"}`}>
                        {d.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: World Timezone Selector */}
            <div className="pt-2 border-t border-[var(--border-color)]">
              <div className="px-1 text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  <span>World Timezones</span>
                </span>
                <span className="text-[9px] text-[var(--text-secondary)]/70">Live sync</span>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto">
                {WORLD_TIMEZONES.map((tz) => {
                  const isSelected = selectedTimezone === tz.id;
                  const tzPreviewDate = now ? getTzDate(tz.timeZone) : new Date();
                  const tzHour = pad(tzPreviewDate.getHours());
                  const tzMin = pad(tzPreviewDate.getMinutes());

                  return (
                    <button
                      key={tz.id}
                      type="button"
                      onClick={() => {
                        setSelectedTimezone(tz.id);
                        localStorage.setItem("dashboard_clock_timezone", tz.id);
                        setIsClockMenuOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[var(--accent-color)] text-white font-bold shadow-xs"
                          : "hover:bg-[var(--bg-primary)] text-[var(--text-primary)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">{tz.flag}</span>
                        <div className="truncate">
                          <div className="text-xs font-bold leading-tight">{tz.label}</div>
                          <div
                            className={`text-[10px] ${
                              isSelected ? "text-white/80" : "text-[var(--text-secondary)]"
                            }`}
                          >
                            {tz.country}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-mono text-xs font-bold ${
                            isSelected ? "text-white" : "text-[var(--text-primary)]"
                          }`}
                        >
                          {tzHour}:{tzMin}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Helper Note */}
            <div className="pt-2 border-t border-[var(--border-color)] text-[10px] text-[var(--text-secondary)] flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3 text-[var(--accent-color)]" />
                <span>Finnish Agency Headquarters</span>
              </span>
              <span className="font-bold text-[var(--text-primary)]">Helsinki (UTC+2)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
