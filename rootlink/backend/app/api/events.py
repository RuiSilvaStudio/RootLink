from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.event import Event, EventRSVP
from app.models.notification import Notification, NotificationType
from app.schemas.event import EventResponse, EventCreate, EventUpdate, RSVPResponse

router = APIRouter(prefix="/api/events", tags=["events"])


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
        max_attendees=event.max_attendees,
        attendee_count=count or 0,
        group_id=event.group_id,
        created_by=event.created_by,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


@router.get("/", response_model=list[EventResponse])
async def list_events(
    upcoming: bool = True,
    category: str | None = None,
    group_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Event)
    if upcoming:
        query = query.where(Event.date >= datetime.now()).order_by(Event.date.asc())
    else:
        query = query.order_by(Event.date.desc())
    if category:
        query = query.where(Event.category == category)
    if group_id:
        query = query.where(Event.group_id == group_id)
    result = await db.execute(query)
    events = result.scalars().all()
    return [await _event_to_response(e, db) for e in events]


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
async def get_event(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return await _event_to_response(event, db)


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    body: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
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
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.delete(event)
    await db.commit()


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
