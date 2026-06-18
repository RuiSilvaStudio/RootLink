from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.message import Conversation, ConversationParticipant, Message
from app.models.notification import Notification, NotificationType
from app.schemas.message import ConversationResponse, MessageResponse, MessageCreate
from app.services.sse import sse_manager

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .join(ConversationParticipant)
        .where(ConversationParticipant.user_id == current_user.id)
        .order_by(Conversation.created_at.desc())
    )
    conversations = result.scalars().all()

    resp = []
    for conv in conversations:
        other = await db.execute(
            select(User)
            .join(ConversationParticipant, User.id == ConversationParticipant.user_id)
            .where(
                ConversationParticipant.conversation_id == conv.id,
                User.id != current_user.id,
            )
        )
        other_user = other.scalar_one_or_none()

        last = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(desc(Message.created_at))
            .limit(1)
        )
        last_msg = last.scalar_one_or_none()

        resp.append(ConversationResponse(
            id=conv.id,
            other_user={
                "id": other_user.id,
                "name": other_user.name,
                "avatar_url": other_user.avatar_url,
            } if other_user else None,
            last_message=last_msg.body[:200] if last_msg else None,
            last_message_at=last_msg.created_at if last_msg else None,
            created_at=conv.created_at,
        ))

    resp.sort(key=lambda c: c.last_message_at or c.created_at or "", reverse=True)
    return resp


@router.get("/conversations/{conversation_id}", response_model=list[MessageResponse])
async def get_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a participant")

    msgs = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return msgs.scalars().all()


@router.post("/send/{user_id}", response_model=ConversationResponse)
async def send_message(
    user_id: int,
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(ConversationParticipant.conversation_id)
        .where(ConversationParticipant.user_id == current_user.id)
    )
    my_conv_ids = [r[0] for r in existing.all()]

    if my_conv_ids:
        others = await db.execute(
            select(ConversationParticipant.conversation_id)
            .where(
                ConversationParticipant.conversation_id.in_(my_conv_ids),
                ConversationParticipant.user_id == user_id,
            )
        )
        existing_conv = others.scalar_one_or_none()
    else:
        existing_conv = None

    if existing_conv:
        conversation_id = existing_conv
    else:
        conv = Conversation()
        db.add(conv)
        await db.flush()

        db.add(ConversationParticipant(conversation_id=conv.id, user_id=current_user.id))
        db.add(ConversationParticipant(conversation_id=conv.id, user_id=user_id))
        conversation_id = conv.id

    msg = Message(conversation_id=conversation_id, sender_id=current_user.id, body=body.body)
    db.add(msg)

    notif = Notification(
        user_id=user_id,
        actor_id=current_user.id,
        type=NotificationType.message,
        message=f"New message from {current_user.name}",
        link="/messages",
    )
    db.add(notif)
    await db.commit()
    await sse_manager.notify(notif.user_id, {"count": 0})

    return ConversationResponse(
        id=conversation_id,
        other_user={"id": target.id, "name": target.name, "avatar_url": target.avatar_url},
        last_message=body.body[:200],
        last_message_at=msg.created_at,
    )
