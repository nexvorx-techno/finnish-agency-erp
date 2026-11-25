"use client";

import React, { useState } from "react";
import {
  Users,
  Clock,
  Fingerprint,
  UserCheck,
  ShieldAlert,
  Edit3,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { WorkerItem, SiteItem } from "../app/page";

interface LiveWorkforceDashboardProps {
  summary: {
    client_name: string;
    total_deployed_headcount: number;
    currently_on_duty: number;
    on_scheduled_break: number;
    reported_absent_or_sick: number;
    sites: SiteItem[];
    workers: WorkerItem[];
  };
  selectedSite: string;
  setSelectedSite: (site: string) => void;
  onSimulatePunch: (workerId: number, siteId: number, currentStatus: string) => Promise<void>;
  onOpenAdjustment: (worker: WorkerItem) => void;
  isSyncing: boolean;
  onRefresh: () => void;
}

export const LiveWorkforceDashboard: React.FC<LiveWorkforceDashboardProps> = ({
  summary,
  selectedSite,
  setSelectedSite,
  onSimulatePunch,
  onOpenAdjustment,
  isSyncing,
  onRefresh,
}) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [actionWorkerId, setActionWorkerId] = useState<number | null>(null);

  // Filter workers based on site and search query
  const filteredWorkers = summary.workers.filter((w) => {
    const matchesSite =
      selectedSite === "all" || w.site_id.toString() === selectedSite;
    const matchesSearch =
      w.worker_name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      w.role_title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      w.site_name.toLowerCase().includes(filterQuery.toLowerCase());
    return matchesSite && matchesSearch;
  });

  const handlePunchClick = async (workerId: number, siteId: number, status: string) => {
    setActionWorkerId(workerId);
    try {
      await onSimulatePunch(workerId, siteId, status);
    } finally {
      setActionWorkerId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ON_DUTY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--badge-green)] text-[var(--badge-green-text)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ON DUTY
          </span>
        );
      case "CLOCKED_OUT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
            CLOCKED OUT
          </span>
        );
      case "SICK_LEAVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--badge-red)] text-[var(--badge-red-text)]">
            SICK LEAVE
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner Card */}
      <div className="relative overflow-hidden rounded-2xl p-6 bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[var(--accent-light)] text-[var(--accent-color)] uppercase tracking-wider">
                Industrial Heavy Tech
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                Teknologiateollisuus TES Standard
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] mt-1.5 tracking-tight">
              {summary.client_name} — Workforce Attendance
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Live on-site staffing attendance for{" "}
              {summary.sites.length > 0
                ? summary.sites.map((s) => `${s.site_code} (${s.city})`).join(" & ")
                : "assigned plant facility"}
              . Shift hours tracked per Finnish Työaikalaki.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)] transition-all shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              Refresh Attendance
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Deployed */}
        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Total Deployed</span>
            <Users className="w-4 h-4 text-[var(--accent-color)]" />
          </div>
          <div className="text-2xl font-black text-[var(--text-primary)] mt-2">
            {summary.total_deployed_headcount}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">
            {summary.sites.length === 1
              ? `Assigned to ${summary.sites[0].site_code}`
              : `Across ${summary.sites.length} assigned facilities`}
          </div>
        </div>

        {/* Currently On Duty */}
        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Currently On Duty</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            {summary.currently_on_duty}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">
            Punched-in via facial scan
          </div>
        </div>

        {/* Shift Hours Today */}
        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Hours Logged Today</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-[var(--text-primary)] mt-2">
            {summary.workers.reduce((acc, w) => acc + (w.shift_hours_so_far || 0), 0).toFixed(1)} h
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">
            Työaikalaki compliance active
          </div>
        </div>

        {/* Sick / Absent */}
        <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Reported Sick / Absent</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-600 mt-2">
            {summary.reported_absent_or_sick}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">
            Kela notice uploaded
          </div>
        </div>
      </div>

      {/* Main Workforce Grid */}
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-[var(--border-color)] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--bg-secondary)]">
          {/* Site Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedSite("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedSite === "all"
                  ? "bg-[var(--accent-color)] text-white shadow-sm"
                  : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:text-[var(--text-primary)]"
              }`}
            >
              All Plants ({summary.workers.length})
            </button>
            {summary.sites.map((site) => (
              <button
                key={site.id}
                onClick={() => setSelectedSite(site.id.toString())}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedSite === site.id.toString()
                    ? "bg-[var(--accent-color)] text-white shadow-sm"
                    : "bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] hover:text-[var(--text-primary)]"
                }`}
              >
                {site.site_code} - {site.site_name.split(" ")[0]}
              </button>
            ))}
          </div>

          {/* Search worker filter */}
          <input
            type="text"
            placeholder="Filter by name, role or plant..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-ring)] md:w-64"
          />
        </div>

        {/* Worker Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Worker & HETU</th>
                <th className="py-3 px-4">Role & Finnish TES</th>
                <th className="py-3 px-4">Plant Location</th>
                <th className="py-3 px-4">Clock-In Time</th>
                <th className="py-3 px-4">Hours Today</th>
                <th className="py-3 px-4">Attendance Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filteredWorkers.map((worker) => (
                <tr
                  key={worker.worker_id}
                  className="hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  {/* Worker Name & HETU */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[var(--text-primary)]">
                      {worker.worker_name}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] font-mono">
                      ID: #{worker.worker_id} • HETU: 1508**-***
                    </div>
                  </td>

                  {/* Role & TES */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[var(--text-primary)]">
                      {worker.role_title}
                    </div>
                    <div className="text-[10px] text-[var(--accent-color)]">
                      {worker.tes_category}
                    </div>
                  </td>

                  {/* Site */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 text-[var(--text-primary)]">
                      <MapPin className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
                      <span>{worker.site_name}</span>
                    </div>
                  </td>

                  {/* Clock In */}
                  <td className="py-3.5 px-4 font-mono text-[var(--text-primary)]">
                    {worker.clock_in_time
                      ? new Date(worker.clock_in_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>

                  {/* Hours */}
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[var(--text-primary)] font-mono">
                      {worker.shift_hours_so_far > 0
                        ? `${worker.shift_hours_so_far.toFixed(2)} h`
                        : "0.00 h"}
                    </div>
                    {worker.shift_hours_so_far > 6.0 && (
                      <span className="text-[9px] text-[var(--text-secondary)]">
                        -30m lunch deducted
                      </span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">{getStatusBadge(worker.status)}</td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Simulate Biometric Punch button */}
                      <button
                        onClick={() =>
                          handlePunchClick(
                            worker.worker_id,
                            worker.site_id,
                            worker.status
                          )
                        }
                        disabled={
                          actionWorkerId === worker.worker_id ||
                          worker.status === "SICK_LEAVE"
                        }
                        title="Simulate Biometric Punch (Clock-in / Clock-out)"
                        className="px-2.5 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] hover:text-[var(--accent-color)] text-[var(--text-secondary)] font-semibold transition-all disabled:opacity-40 flex items-center gap-1"
                      >
                        <Fingerprint className="w-3.5 h-3.5" />
                        <span>
                          {worker.status === "ON_DUTY" ? "Clock Out" : "Clock In"}
                        </span>
                      </button>

                      {/* Supervisor Adjust Hours button */}
                      <button
                        onClick={() => onOpenAdjustment(worker)}
                        title="Supervisor Manual Hours Override"
                        className="p-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
