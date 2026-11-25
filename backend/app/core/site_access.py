from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.client import ClientUser, ClientSite


def parse_user_site_ids(assigned_site_ids: Optional[str]) -> Optional[List[int]]:
    """
    Parses a user's `assigned_site_ids` string:
    - Returns `None` ONLY if user is explicitly granted all sites ("*" or "all").
    - Otherwise returns a list of integer site IDs the user is strictly restricted to.
    """
    if assigned_site_ids is None:
        return None
    raw = assigned_site_ids.strip()
    if raw == "*" or raw.lower() == "all":
        return None
    if not raw:
        return []
    ids: List[int] = []
    for part in raw.split(","):
        p = part.strip()
        if p.isdigit():
            ids.append(int(p))
    return ids


def get_allowed_site_ids_for_user(
    db: Session,
    client_id: int,
    user_id: Optional[int] = None,
    requested_site_id: Optional[int] = None,
) -> Optional[List[int]]:
    """
    Strictly resolves which site IDs the requesting user is allowed to access or mutate.
    - If `user_id` is provided and the user is assigned to specific site(s):
      * If `requested_site_id` is specified and NOT in user's assigned sites -> raises HTTP 403.
      * If `requested_site_id` is specified and allowed -> returns `[requested_site_id]`.
      * If `requested_site_id` is None -> returns `user_allowed_ids` (never unassigned sites!).
    - If user has all-sites access ("*") or `user_id` is None:
      * Returns `[requested_site_id]` if `requested_site_id` is specified, else `None` (all client sites).
    """
    allowed_ids: Optional[List[int]] = None
    if user_id:
        user = (
            db.query(ClientUser)
            .filter(ClientUser.id == user_id, ClientUser.client_id == client_id)
            .first()
        )
        if user:
            allowed_ids = parse_user_site_ids(user.assigned_site_ids)

    if allowed_ids is not None:
        if requested_site_id is not None:
            if requested_site_id not in allowed_ids:
                raise HTTPException(
                    status_code=403,
                    detail="Strict site access: You are only authorized to access and work on your assigned site.",
                )
            return [requested_site_id]
        return allowed_ids

    if requested_site_id is not None:
        return [requested_site_id]
    return None


def assert_user_can_access_site(
    db: Session,
    client_id: int,
    user_id: Optional[int],
    target_site_id: Optional[int],
) -> None:
    """
    Raises HTTP 403 if a site-restricted user attempts to create, edit, or act on
    a record belonging to an unassigned site.
    """
    if not user_id or target_site_id is None:
        return
    user = (
        db.query(ClientUser)
        .filter(ClientUser.id == user_id, ClientUser.client_id == client_id)
        .first()
    )
    if not user:
        return
    allowed_ids = parse_user_site_ids(user.assigned_site_ids)
    if allowed_ids is not None and target_site_id not in allowed_ids:
        site = db.query(ClientSite).filter(ClientSite.id == target_site_id).first()
        site_label = f"{site.site_code} ({site.site_name})" if site else f"Site #{target_site_id}"
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: Your account is not assigned to {site_label}.",
        )
