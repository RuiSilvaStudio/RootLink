import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.event import (
    Event,
    EventAmenity,
    EventDonation,
    EventRSVP,
    EventSchedule,
    EventSponsor,
    EventTicket,
    EventVendor,
    EventVenue,
)
from app.models.group import GroupMember
from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole
from app.schemas.event import (
    AmenityCreate,
    AmenityResponse,
    AmenityUpdate,
    CheckInResponse,
    DonationCreate,
    DonationResponse,
    DonationStats,
    EventCreate,
    EventResponse,
    EventUpdate,
    RSVPResponse,
    ScheduleCreate,
    ScheduleResponse,
    ScheduleUpdate,
    SponsorCreate,
    SponsorResponse,
    SponsorUpdate,
    TicketPurchase,
    TicketResponse,
    VendorCreate,
    VendorResponse,
    VendorUpdate,
    VenueCreate,
    VenueResponse,
)
from app.services.sse import sse_manager

router = APIRouter(prefix="/api/events", tags=["events"])


# ── Helpers ────────────────────────────────────────────────────────────

async def _event_to_response(event: Event, db: AsyncSession) -> EventResponse:
    count = await db.scalar(
        select(func.count(EventRSVP.id)).where(EventRSVP.event_id == event.id)
    )
    return EventResponse(
        id=event.id,
        title=event.title,
        description=event.description,
        date=event.date,
        end_date=event.end_date,
        location=event.location,
        url=event.url,
        image_url=event.image_url,
        is_online=event.is_online,
        category=event.category,
        family=event.family,
        max_attendees=event.max_attendees,
        attendee_count=count or 0,
        group_id=event.group_id,
        created_by=event.created_by,
        created_at=event.created_at,
        updated_at=event.updated_at,
        visibility=event.visibility,
        visibility_roles=event.visibility_roles,
        status=event.status,
        ticket_type=event.ticket_type,
        ticket_price=event.ticket_price,
        ticket_tiers=event.ticket_tiers,
        currency=event.currency,
        donation_goal=event.donation_goal,
        description_long=event.description_long,
        contact_email=event.contact_email,
        contact_phone=event.contact_phone,
        requirements=event.requirements,
        tags=event.tags,
        image_gallery=event.image_gallery,
        recurrence_type=event.recurrence_type,
        recurrence_config=event.recurrence_config,
    )


async def _check_event_owner(event_id: int, user: User, db: AsyncSession) -> Event:
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.created_by != user.id and user.role not in (UserRole.admin, UserRole.moderator):
        raise HTTPException(status_code=403, detail="Not authorized")
    return event


async def _can_view_event(event: Event, user: User | None, db: AsyncSession) -> bool:
    # Draft check FIRST — drafts only visible to creator + admin/mod,
    # regardless of visibility setting.
    if event.status == "draft":
        if user is None or (event.created_by != user.id and user.role not in (UserRole.admin, UserRole.moderator)):
            return False
    if event.visibility == "all":
        return True
    if user is None:
        return False
    if event.created_by == user.id or user.role in (UserRole.admin, UserRole.moderator):
        return True
    if event.visibility == "registered":
        return True
    if event.visibility == "role_based":
        allowed = event.visibility_roles or []
        return user.role.value in allowed
    if event.visibility == "group_only" and event.group_id:
        member = await db.scalar(
            select(GroupMember).where(
                GroupMember.group_id == event.group_id,
                GroupMember.user_id == user.id,
            )
        )
        return member is not None
    return False


# ── Event CRUD ─────────────────────────────────────────────────────────

@router.get("/", response_model=list[EventResponse])
async def list_events(
    upcoming: bool = True,
    category: str | None = None,
    family: str | None = None,
    group_id: int | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    query = select(Event)
    if upcoming:
        query = query.where(Event.date >= datetime.now()).order_by(Event.date.asc())
    else:
        query = query.order_by(Event.date.desc())
    if category:
        query = query.where(Event.category == category)
    if family:
        query = query.where(Event.family == family)
    if group_id:
        query = query.where(Event.group_id == group_id)
    if status:
        query = query.where(Event.status == status)

    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    events = result.scalars().all()

    # Batch group membership check to avoid N+1 queries for group_only events
    if current_user:
        group_ids = {e.group_id for e in events if e.visibility == "group_only" and e.group_id}
        member_group_ids: set[int] = set()
        if group_ids:
            member_result = await db.execute(
                select(GroupMember.group_id).where(
                    GroupMember.group_id.in_(group_ids),
                    GroupMember.user_id == current_user.id,
                )
            )
            member_group_ids = {r[0] for r in member_result.all()}

        visible = []
        for e in events:
            if e.visibility == "group_only":
                if e.group_id in member_group_ids or e.created_by == current_user.id or current_user.role in (UserRole.admin, UserRole.moderator):
                    visible.append(e)
                continue
            if await _can_view_event(e, current_user, db):
                visible.append(e)
    else:
        visible = [e for e in events if await _can_view_event(e, None, db)]

    return [await _event_to_response(e, db) for e in visible]


@router.post("/", response_model=EventResponse, status_code=201)
async def create_event(
    body: EventCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = Event(**body.model_dump(), created_by=current_user.id)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return await _event_to_response(event, db)


@router.get("/my/rsvps", response_model=list[RSVPResponse])
async def my_rsvps(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EventRSVP).where(EventRSVP.user_id == current_user.id)
    )
    return result.scalars().all()


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not await _can_view_event(event, current_user, db):
        raise HTTPException(status_code=404, detail="Event not found")
    return await _event_to_response(event, db)


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    body: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await _check_event_owner(event_id, current_user, db)
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(event, key, val)
    await db.commit()
    await db.refresh(event)
    return await _event_to_response(event, db)


@router.delete("/{event_id}", status_code=204)
async def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await _check_event_owner(event_id, current_user, db)
    await db.delete(event)
    await db.commit()


# ── RSVP ───────────────────────────────────────────────────────────────

@router.post("/{event_id}/rsvp", response_model=RSVPResponse)
async def rsvp_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    existing = await db.execute(
        select(EventRSVP).where(
            EventRSVP.event_id == event_id,
            EventRSVP.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already RSVPed")

    if event.max_attendees:
        count = await db.scalar(
            select(func.count(EventRSVP.id)).where(EventRSVP.event_id == event_id)
        )
        if count and count >= event.max_attendees:
            raise HTTPException(status_code=400, detail="Event is full")

    rsvp = EventRSVP(event_id=event_id, user_id=current_user.id)
    db.add(rsvp)
    await db.commit()
    await db.refresh(rsvp)

    if event.created_by != current_user.id:
        notif = Notification(
            user_id=event.created_by,
            actor_id=current_user.id,
            type=NotificationType.event_rsvp,
            message=f"{current_user.name} RSVPed to your event: {event.title}",
            link=f"/events/{event_id}",
        )
        db.add(notif)
        await db.commit()
        await sse_manager.notify(notif.user_id, {"count": 0})

    return rsvp


@router.delete("/{event_id}/rsvp", status_code=204)
async def cancel_rsvp(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EventRSVP).where(
            EventRSVP.event_id == event_id,
            EventRSVP.user_id == current_user.id,
        )
    )
    rsvp = result.scalar_one_or_none()
    if not rsvp:
        raise HTTPException(status_code=404, detail="RSVP not found")
    await db.delete(rsvp)
    await db.commit()


@router.get("/{event_id}/attendees", response_model=list[dict])
async def list_attendees(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User.id, User.name, User.email)
        .join(EventRSVP, User.id == EventRSVP.user_id)
        .where(EventRSVP.event_id == event_id)
    )
    return [{"id": r[0], "name": r[1], "email": r[2]} for r in result.all()]


# ── Venue ──────────────────────────────────────────────────────────────

@router.get("/{event_id}/venue", response_model=VenueResponse | None)
async def get_venue(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EventVenue).where(EventVenue.event_id == event_id))
    venue = result.scalar_one_or_none()
    return venue


@router.post("/{event_id}/venue", response_model=VenueResponse, status_code=201)
async def upsert_venue(
    event_id: int,
    body: VenueCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    result = await db.execute(select(EventVenue).where(EventVenue.event_id == event_id))
    venue = result.scalar_one_or_none()
    if venue:
        for key, val in body.model_dump(exclude_unset=True).items():
            setattr(venue, key, val)
    else:
        venue = EventVenue(event_id=event_id, **body.model_dump())
        db.add(venue)
    await db.commit()
    await db.refresh(venue)
    return venue


# ── Amenities ──────────────────────────────────────────────────────────

@router.get("/{event_id}/amenities", response_model=list[AmenityResponse])
async def list_amenities(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EventAmenity).where(EventAmenity.event_id == event_id)
    )
    return result.scalars().all()


@router.post("/{event_id}/amenities", response_model=AmenityResponse, status_code=201)
async def create_amenity(
    event_id: int,
    body: AmenityCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    amenity = EventAmenity(event_id=event_id, **body.model_dump())
    db.add(amenity)
    await db.commit()
    await db.refresh(amenity)
    return amenity


@router.put("/{event_id}/amenities/{amenity_id}", response_model=AmenityResponse)
async def update_amenity(
    event_id: int,
    amenity_id: int,
    body: AmenityUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    result = await db.execute(
        select(EventAmenity).where(EventAmenity.id == amenity_id, EventAmenity.event_id == event_id)
    )
    amenity = result.scalar_one_or_none()
    if not amenity:
        raise HTTPException(status_code=404, detail="Amenity not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(amenity, key, val)
    await db.commit()
    await db.refresh(amenity)
    return amenity


@router.delete("/{event_id}/amenities/{amenity_id}", status_code=204)
async def delete_amenity(
    event_id: int,
    amenity_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    result = await db.execute(
        select(EventAmenity).where(EventAmenity.id == amenity_id, EventAmenity.event_id == event_id)
    )
    amenity = result.scalar_one_or_none()
    if not amenity:
        raise HTTPException(status_code=404, detail="Amenity not found")
    await db.delete(amenity)
    await db.commit()


# ── Schedule ───────────────────────────────────────────────────────────

@router.get("/{event_id}/schedule", response_model=list[ScheduleResponse])
async def list_schedule(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EventSchedule)
        .where(EventSchedule.event_id == event_id)
        .order_by(EventSchedule.sort_order, EventSchedule.start_time)
    )
    return result.scalars().all()


@router.post("/{event_id}/schedule", response_model=ScheduleResponse, status_code=201)
async def create_schedule_item(
    event_id: int,
    body: ScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    item = EventSchedule(event_id=event_id, **body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{event_id}/schedule/{item_id}", response_model=ScheduleResponse)
async def update_schedule_item(
    event_id: int,
    item_id: int,
    body: ScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    result = await db.execute(
        select(EventSchedule).where(EventSchedule.id == item_id, EventSchedule.event_id == event_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Schedule item not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(item, key, val)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{event_id}/schedule/{item_id}", status_code=204)
async def delete_schedule_item(
    event_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    result = await db.execute(
        select(EventSchedule).where(EventSchedule.id == item_id, EventSchedule.event_id == event_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Schedule item not found")
    await db.delete(item)
    await db.commit()


# ── Sponsors ───────────────────────────────────────────────────────────

@router.get("/{event_id}/sponsors", response_model=list[SponsorResponse])
async def list_sponsors(
    event_id: int,
    visible_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    query = select(EventSponsor).where(
        EventSponsor.event_id == event_id, EventSponsor.is_active.is_(True)
    )
    if visible_only:
        query = query.where(EventSponsor.visible_to_attendees.is_(True))
    query = query.order_by(EventSponsor.sort_order)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{event_id}/sponsors", response_model=SponsorResponse, status_code=201)
async def create_sponsor(
    event_id: int,
    body: SponsorCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    sponsor = EventSponsor(event_id=event_id, **body.model_dump())
    db.add(sponsor)
    await db.commit()
    await db.refresh(sponsor)
    return sponsor


@router.put("/{event_id}/sponsors/{sponsor_id}", response_model=SponsorResponse)
async def update_sponsor(
    event_id: int,
    sponsor_id: int,
    body: SponsorUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    result = await db.execute(
        select(EventSponsor).where(EventSponsor.id == sponsor_id, EventSponsor.event_id == event_id)
    )
    sponsor = result.scalar_one_or_none()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(sponsor, key, val)
    await db.commit()
    await db.refresh(sponsor)
    return sponsor


@router.delete("/{event_id}/sponsors/{sponsor_id}", status_code=204)
async def delete_sponsor(
    event_id: int,
    sponsor_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    result = await db.execute(
        select(EventSponsor).where(EventSponsor.id == sponsor_id, EventSponsor.event_id == event_id)
    )
    sponsor = result.scalar_one_or_none()
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor not found")
    await db.delete(sponsor)
    await db.commit()


# ── Vendors ────────────────────────────────────────────────────────────

@router.get("/{event_id}/vendors", response_model=list[VendorResponse])
async def list_vendors(
    event_id: int,
    visible_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    query = select(EventVendor).where(EventVendor.event_id == event_id)
    if visible_only:
        query = query.where(EventVendor.visible_to_attendees.is_(True))
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{event_id}/vendors", response_model=VendorResponse, status_code=201)
async def create_vendor(
    event_id: int,
    body: VendorCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    vendor = EventVendor(event_id=event_id, **body.model_dump())
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    return vendor


@router.put("/{event_id}/vendors/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    event_id: int,
    vendor_id: int,
    body: VendorUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    result = await db.execute(
        select(EventVendor).where(EventVendor.id == vendor_id, EventVendor.event_id == event_id)
    )
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(vendor, key, val)
    await db.commit()
    await db.refresh(vendor)
    return vendor


@router.delete("/{event_id}/vendors/{vendor_id}", status_code=204)
async def delete_vendor(
    event_id: int,
    vendor_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    result = await db.execute(
        select(EventVendor).where(EventVendor.id == vendor_id, EventVendor.event_id == event_id)
    )
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    await db.delete(vendor)
    await db.commit()


# ── Donations ──────────────────────────────────────────────────────────

@router.get("/{event_id}/donations/stats", response_model=DonationStats)
async def donation_stats(event_id: int, db: AsyncSession = Depends(get_db)):
    total = await db.scalar(
        select(func.coalesce(func.sum(EventDonation.amount), 0)).where(
            EventDonation.event_id == event_id,
            EventDonation.payment_status == "completed",
        )
    )
    count = await db.scalar(
        select(func.count(EventDonation.id)).where(
            EventDonation.event_id == event_id,
            EventDonation.payment_status == "completed",
        )
    )
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    goal = event.donation_goal if event else None
    progress = (total / goal * 100) if goal and goal > 0 else 0.0
    return DonationStats(
        total_raised=total, donation_count=count or 0, goal=goal, progress_pct=progress
    )


@router.get("/{event_id}/donations", response_model=list[DonationResponse])
async def list_donations(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EventDonation)
        .where(EventDonation.event_id == event_id, EventDonation.payment_status == "completed")
        .order_by(EventDonation.created_at.desc())
    )
    donations = result.scalars().all()
    return [
        DonationResponse(
            id=d.id, event_id=d.event_id, user_id=d.user_id, amount=d.amount,
            currency=d.currency, donor_name="Anonymous" if d.is_anonymous else d.donor_name,
            message=d.message, is_anonymous=d.is_anonymous, payment_method=d.payment_method,
            payment_status=d.payment_status, created_at=d.created_at,
        )
        for d in donations
    ]


@router.post("/{event_id}/donate", response_model=DonationResponse, status_code=201)
async def make_donation(
    event_id: int,
    body: DonationCreate,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.ticket_type not in ("donation_based", "free"):
        raise HTTPException(status_code=400, detail="This event does not accept donations")
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Donation amount must be positive")

    donation = EventDonation(
        event_id=event_id,
        user_id=current_user.id if current_user else None,
        amount=body.amount,
        currency=body.currency,
        donor_name=body.donor_name,
        donor_email=body.donor_email,
        message=body.message,
        is_anonymous=body.is_anonymous,
        payment_method=body.payment_method,
        payment_status="completed",
        transaction_id=str(uuid.uuid4()),
    )
    db.add(donation)
    await db.commit()
    await db.refresh(donation)
    return donation


# ── Tickets ────────────────────────────────────────────────────────────

@router.post("/{event_id}/tickets/purchase", response_model=TicketResponse, status_code=201)
async def purchase_ticket(
    event_id: int,
    body: TicketPurchase,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.ticket_type == "free":
        raise HTTPException(status_code=400, detail="This is a free event — use RSVP instead")
    if body.quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    if event.max_attendees:
        ticket_count = await db.scalar(
            select(func.coalesce(func.sum(EventTicket.quantity), 0)).where(
                EventTicket.event_id == event_id,
                EventTicket.payment_status == "completed",
            )
        )
        if ticket_count and ticket_count + body.quantity > event.max_attendees:
            raise HTTPException(status_code=400, detail="Not enough tickets available")

    price = event.ticket_price or 0
    if event.ticket_tiers:
        matched = False
        for tier in event.ticket_tiers:
            if tier.get("type") == body.ticket_type:
                price = tier.get("price", 0)
                matched = True
                break
        if not matched:
            raise HTTPException(status_code=400, detail="Invalid ticket type")
    total = price * body.quantity

    ticket = EventTicket(
        event_id=event_id,
        user_id=current_user.id,
        ticket_type=body.ticket_type,
        price=price,
        quantity=body.quantity,
        total_paid=total,
        payment_status="completed",
        transaction_id=str(uuid.uuid4()),
        qr_code=str(uuid.uuid4()),
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return ticket


@router.get("/{event_id}/tickets/my", response_model=TicketResponse | None)
async def my_ticket(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EventTicket).where(
            EventTicket.event_id == event_id,
            EventTicket.user_id == current_user.id,
            EventTicket.payment_status == "completed",
        )
    )
    return result.scalar_one_or_none()


@router.post("/{event_id}/check-in/{ticket_id}", response_model=CheckInResponse)
async def check_in_ticket(
    event_id: int,
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _check_event_owner(event_id, current_user, db)
    result = await db.execute(
        select(EventTicket).where(EventTicket.id == ticket_id, EventTicket.event_id == event_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.checked_in:
        raise HTTPException(status_code=400, detail="Already checked in")

    ticket.checked_in = True
    ticket.checked_in_at = datetime.now()
    await db.commit()

    user_result = await db.execute(select(User).where(User.id == ticket.user_id))
    user = user_result.scalar_one_or_none()
    return CheckInResponse(
        ticket_id=ticket.id,
        attendee_name=user.name if user else "Unknown",
        ticket_type=ticket.ticket_type,
        checked_in_at=ticket.checked_in_at,
    )
