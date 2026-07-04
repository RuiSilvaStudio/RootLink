from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import rank_at_least
from app.core.permissions_registry import Rank
from app.core.security import get_current_user
from app.models.learning import (
    Course,
    Enrollment,
    LearningPath,
    LearningPathCourse,
    Lesson,
    LessonProgress,
)
from app.models.user import User
from app.schemas.learning import (
    CourseCreate,
    CourseResponse,
    CourseUpdate,
    EnrollmentResponse,
    LearningPathCourseCreate,
    LearningPathCreate,
    LearningPathResponse,
    LearningPathUpdate,
    LessonCreate,
    LessonProgressResponse,
    LessonResponse,
    LessonUpdate,
)

router = APIRouter(prefix="/api/learning", tags=["learning"])


def _can_manage(user: User, owner_id: int) -> bool:
    # TECH_DEBT.md §0 (was missing super_admin) — Phase 3 cutover.
    return rank_at_least(user, Rank.moderator) or user.id == owner_id


def _staff_only(user: User):
    # TECH_DEBT.md §0 (was missing super_admin) — Phase 3 cutover.
    if not rank_at_least(user, Rank.contributor):
        raise HTTPException(status_code=403, detail="Not enough permissions")


async def _course_to_response(course: Course, db: AsyncSession) -> CourseResponse:
    cnt = await db.scalar(
        select(func.count(Lesson.id)).where(Lesson.course_id == course.id)
    )
    return CourseResponse(
        id=course.id,
        title=course.title,
        description=course.description,
        category=course.category,
        family=course.family,
        image_url=course.image_url,
        difficulty=course.difficulty,
        estimated_hours=course.estimated_hours,
        published=course.published,
        lesson_count=cnt or 0,
        created_by=course.created_by,
        created_at=course.created_at,
        updated_at=course.updated_at,
    )


# ─── Courses ────────────────────────────────────────────
@router.get("/courses", response_model=list[CourseResponse])
async def list_courses(
    category: str | None = None,
    family: str | None = None,
    published: bool = True,
    db: AsyncSession = Depends(get_db),
):
    query = select(Course)
    if published:
        query = query.where(Course.published.is_(True))
    if category:
        query = query.where(Course.category == category)
    if family:
        query = query.where(Course.family == family)
    query = query.order_by(Course.created_at.desc())
    result = await db.execute(query)
    courses = result.scalars().all()
    return [await _course_to_response(c, db) for c in courses]


@router.post("/courses", response_model=CourseResponse, status_code=201)
async def create_course(
    body: CourseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _staff_only(current_user)
    course = Course(**body.model_dump(), created_by=current_user.id)
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return await _course_to_response(course, db)


@router.get("/courses/{course_id}", response_model=CourseResponse)
async def get_course(course_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return await _course_to_response(course, db)


@router.put("/courses/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: int,
    body: CourseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not _can_manage(current_user, course.created_by):
        raise HTTPException(status_code=403, detail="Not authorized")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(course, key, val)
    await db.commit()
    await db.refresh(course)
    return await _course_to_response(course, db)


@router.delete("/courses/{course_id}", status_code=204)
async def delete_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not _can_manage(current_user, course.created_by):
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.delete(course)
    await db.commit()


@router.get("/my/courses", response_model=list[CourseResponse])
async def my_courses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TECH_DEBT.md §0 (was missing super_admin) — Phase 3 cutover.
    if rank_at_least(current_user, Rank.moderator):
        result = await db.execute(select(Course).order_by(Course.created_at.desc()))
    else:
        result = await db.execute(
            select(Course).where(Course.created_by == current_user.id).order_by(Course.created_at.desc())
        )
    courses = result.scalars().all()
    return [await _course_to_response(c, db) for c in courses]


# ─── Lessons ────────────────────────────────────────────
@router.get("/courses/{course_id}/lessons", response_model=list[LessonResponse])
async def list_lessons(course_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Lesson)
        .where(Lesson.course_id == course_id)
        .order_by(Lesson.order)
    )
    return result.scalars().all()


@router.post("/courses/{course_id}/lessons", response_model=LessonResponse, status_code=201)
async def create_lesson(
    course_id: int,
    body: LessonCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not _can_manage(current_user, course.created_by):
        raise HTTPException(status_code=403, detail="Not authorized")

    lesson = Lesson(course_id=course_id, **body.model_dump())
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson


@router.put("/lessons/{lesson_id}", response_model=LessonResponse)
async def update_lesson(
    lesson_id: int,
    body: LessonUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    course = await db.get(Course, lesson.course_id)
    if not _can_manage(current_user, course.created_by):
        raise HTTPException(status_code=403, detail="Not authorized")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(lesson, key, val)
    await db.commit()
    await db.refresh(lesson)
    return lesson


@router.delete("/lessons/{lesson_id}", status_code=204)
async def delete_lesson(
    lesson_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    course = await db.get(Course, lesson.course_id)
    if not _can_manage(current_user, course.created_by):
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.delete(lesson)
    await db.commit()


# ─── Learning Paths ─────────────────────────────────────
@router.get("/paths", response_model=list[LearningPathResponse])
async def list_paths(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LearningPath).order_by(LearningPath.created_at.desc()))
    return result.scalars().all()


@router.post("/paths", response_model=LearningPathResponse, status_code=201)
async def create_path(
    body: LearningPathCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _staff_only(current_user)
    path = LearningPath(**body.model_dump(), created_by=current_user.id)
    db.add(path)
    await db.commit()
    await db.refresh(path)
    return path


@router.get("/paths/{path_id}", response_model=LearningPathResponse)
async def get_path(path_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LearningPath).where(LearningPath.id == path_id))
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    return path


@router.put("/paths/{path_id}", response_model=LearningPathResponse)
async def update_path(
    path_id: int,
    body: LearningPathUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LearningPath).where(LearningPath.id == path_id))
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    if not _can_manage(current_user, path.created_by):
        raise HTTPException(status_code=403, detail="Not authorized")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(path, key, val)
    await db.commit()
    await db.refresh(path)
    return path


@router.delete("/paths/{path_id}", status_code=204)
async def delete_path(
    path_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LearningPath).where(LearningPath.id == path_id))
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    if not _can_manage(current_user, path.created_by):
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.delete(path)
    await db.commit()


@router.post("/paths/{path_id}/courses", status_code=201)
async def add_course_to_path(
    path_id: int,
    body: LearningPathCourseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LearningPath).where(LearningPath.id == path_id))
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    if not _can_manage(current_user, path.created_by):
        raise HTTPException(status_code=403, detail="Not authorized")

    link = LearningPathCourse(learning_path_id=path_id, **body.model_dump())
    db.add(link)
    await db.commit()
    return {"status": "ok"}


@router.delete("/paths/{path_id}/courses/{course_id}", status_code=204)
async def remove_course_from_path(
    path_id: int,
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LearningPath).where(LearningPath.id == path_id))
    path = result.scalar_one_or_none()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    if not _can_manage(current_user, path.created_by):
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.execute(
        delete(LearningPathCourse).where(
            LearningPathCourse.learning_path_id == path_id,
            LearningPathCourse.course_id == course_id,
        )
    )
    await db.commit()



@router.get("/my/paths", response_model=list[LearningPathResponse])
async def my_paths(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TECH_DEBT.md §0 (was missing super_admin) — Phase 3 cutover.
    if rank_at_least(current_user, Rank.moderator):
        result = await db.execute(select(LearningPath).order_by(LearningPath.created_at.desc()))
    else:
        result = await db.execute(
            select(LearningPath).where(LearningPath.created_by == current_user.id).order_by(LearningPath.created_at.desc())
        )
    return result.scalars().all()


@router.get("/paths/{path_id}/courses", response_model=list[CourseResponse])
async def get_path_courses(path_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Course)
        .join(LearningPathCourse, Course.id == LearningPathCourse.course_id)
        .where(LearningPathCourse.learning_path_id == path_id)
        .order_by(LearningPathCourse.order)
    )
    courses = result.scalars().all()
    return [await _course_to_response(c, db) for c in courses]


# ─── Enrollment & Progress ──────────────────────────────
@router.post("/courses/{course_id}/enroll", response_model=EnrollmentResponse)
async def enroll(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Course not found")

    existing = await db.execute(
        select(Enrollment).where(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == course_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already enrolled")

    enrollment = Enrollment(user_id=current_user.id, course_id=course_id)
    db.add(enrollment)
    await db.commit()
    await db.refresh(enrollment)

    lesson_progress = await db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == current_user.id,
            LessonProgress.lesson_id.in_(
                select(Lesson.id).where(Lesson.course_id == course_id)
            ),
        )
    )
    return EnrollmentResponse(
        id=enrollment.id,
        user_id=enrollment.user_id,
        course_id=enrollment.course_id,
        completed=enrollment.completed,
        completed_at=enrollment.completed_at,
        lesson_progress=[{"lesson_id": lp.lesson_id, "completed": lp.completed} for lp in lesson_progress.scalars().all()],
        created_at=enrollment.created_at,
    )


@router.get("/my/enrollments", response_model=list[EnrollmentResponse])
async def my_enrollments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Enrollment).where(Enrollment.user_id == current_user.id)
    )
    enrollments = result.scalars().all()
    resp = []
    for enrollment in enrollments:
        lp = await db.execute(
            select(LessonProgress).where(
                LessonProgress.user_id == current_user.id,
                LessonProgress.lesson_id.in_(
                    select(Lesson.id).where(Lesson.course_id == enrollment.course_id)
                ),
            )
        )
        resp.append(EnrollmentResponse(
            id=enrollment.id,
            user_id=enrollment.user_id,
            course_id=enrollment.course_id,
            completed=enrollment.completed,
            completed_at=enrollment.completed_at,
            lesson_progress=[{"lesson_id": p.lesson_id, "completed": p.completed} for p in lp.scalars().all()],
            created_at=enrollment.created_at,
        ))
    return resp


@router.post("/lessons/{lesson_id}/progress", response_model=LessonProgressResponse)
async def mark_lesson(
    lesson_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(LessonProgress).where(
            LessonProgress.user_id == current_user.id,
            LessonProgress.lesson_id == lesson_id,
        )
    )
    lp = existing.scalar_one_or_none()
    if lp:
        return lp

    lp = LessonProgress(user_id=current_user.id, lesson_id=lesson_id, completed=True)
    db.add(lp)

    lesson = await db.get(Lesson, lesson_id)
    if lesson:
        total = await db.scalar(
            select(func.count(Lesson.id)).where(Lesson.course_id == lesson.course_id)
        )
        done = await db.scalar(
            select(func.count(LessonProgress.id))
            .where(
                LessonProgress.user_id == current_user.id,
                LessonProgress.lesson_id.in_(
                    select(Lesson.id).where(Lesson.course_id == lesson.course_id)
                ),
            )
        )
        if total and done and done >= total:
            enrollment = await db.execute(
                select(Enrollment).where(
                    Enrollment.user_id == current_user.id,
                    Enrollment.course_id == lesson.course_id,
                )
            )
            enr = enrollment.scalar_one_or_none()
            if enr:
                enr.completed = True
                enr.completed_at = func.now()

    await db.commit()
    await db.refresh(lp)
    return lp
