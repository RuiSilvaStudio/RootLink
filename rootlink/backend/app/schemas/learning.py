from datetime import datetime

from pydantic import BaseModel


class CourseResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    category: str | None = None
    family: str | None = None
    image_url: str | None = None
    difficulty: str | None = None
    estimated_hours: int | None = None
    published: bool = False
    lesson_count: int = 0
    created_by: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class CourseCreate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    family: str | None = None
    image_url: str | None = None
    difficulty: str | None = None
    estimated_hours: int | None = None
    published: bool = False


class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    family: str | None = None
    image_url: str | None = None
    difficulty: str | None = None
    estimated_hours: int | None = None
    published: bool | None = None


class LessonResponse(BaseModel):
    id: int
    course_id: int
    title: str
    body: str | None = None
    video_url: str | None = None
    order: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class LessonCreate(BaseModel):
    title: str
    body: str | None = None
    video_url: str | None = None
    order: int


class LessonUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    video_url: str | None = None
    order: int | None = None


class LearningPathResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    image_url: str | None = None
    created_by: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class LearningPathCreate(BaseModel):
    title: str
    description: str | None = None
    image_url: str | None = None


class LearningPathUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    image_url: str | None = None


class LearningPathCourseCreate(BaseModel):
    course_id: int
    order: int


class EnrollmentResponse(BaseModel):
    id: int
    user_id: int
    course_id: int
    completed: bool = False
    completed_at: datetime | None = None
    lesson_progress: list[dict] = []
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class LessonProgressResponse(BaseModel):
    id: int
    user_id: int
    lesson_id: int
    completed: bool = False
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
