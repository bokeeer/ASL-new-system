import React, { createContext, useContext, useState } from 'react';
import { subjectsData as initialSubjectsData, Subject, LessonContent } from '../data/subjects';

type SubjectsContextType = {
  subjects: Record<string, Subject>;
  addLesson: (
    subjectId: string,
    topicId: string,
    lesson: {
      id?: string;
      title: string;
      deafTitle?: string;
      description?: string;
      descriptions?: string[];
      deafDescription?: string;
      deafDescriptions?: string[];
      tip?: string;
      deafTip?: string;
    }
  ) => void;
  deleteLesson: (subjectId: string, topicId: string, lessonId: string) => void;
  setTopicLessons: (subjectId: string, topicId: string, lessons: LessonContent[]) => void;
};

const SubjectsContext = createContext<SubjectsContextType | undefined>(undefined);

export function SubjectsProvider({ children }: { children: React.ReactNode }) {
  const [subjects, setSubjects] = useState<Record<string, Subject>>(initialSubjectsData);

  const addLesson = (
    subjectId: string,
    topicId: string,
    lesson: {
      id?: string;
      title: string;
      deafTitle?: string;
      description?: string;
      descriptions?: string[];
      deafDescription?: string;
      deafDescriptions?: string[];
      tip?: string;
      deafTip?: string;
    }
  ) => {
    setSubjects((prev) => {
      const nextSubjects = JSON.parse(JSON.stringify(prev)); // Deep clone to trigger React state updates
      const subject = nextSubjects[subjectId];
      if (subject) {
        for (const category of subject.categories) {
          const topic = category.topics.find((t: any) => t.id === topicId);
          if (topic) {
            const descList = lesson.descriptions && lesson.descriptions.length > 0
              ? lesson.descriptions
              : (lesson.description ? [lesson.description] : []);

            const mainDesc = descList[0] || '';
            const newLessonId = lesson.id || (topic.lessons.length + 1).toString();
            
            topic.lessons.push({
              id: newLessonId,
              title: lesson.title,
              deafTitle: lesson.deafTitle || lesson.title.toUpperCase(),
              description: mainDesc,
              descriptions: descList,
              deafDescription: lesson.deafDescription || mainDesc.toUpperCase(),
              deafDescriptions: descList.map(d => d.toUpperCase()),
              tip: lesson.tip || '',
              deafTip: lesson.deafTip || (lesson.tip ? lesson.tip.toUpperCase() : ''),
            });
            break;
          }
        }
      }
      return nextSubjects;
    });
  };

  const setTopicLessons = (subjectId: string, topicId: string, lessons: LessonContent[]) => {
    setSubjects((prev) => {
      const nextSubjects = JSON.parse(JSON.stringify(prev));
      const subject = nextSubjects[subjectId];
      if (subject) {
        for (const category of subject.categories) {
          const topic = category.topics.find((t: any) => t.id === topicId);
          if (topic) {
            topic.lessons = lessons;
            break;
          }
        }
      }
      return nextSubjects;
    });
  };

  const deleteLesson = (subjectId: string, topicId: string, lessonId: string) => {
    setSubjects((prev) => {
      const nextSubjects = JSON.parse(JSON.stringify(prev));
      const subject = nextSubjects[subjectId];
      if (subject) {
        for (const category of subject.categories) {
          const topic = category.topics.find((t: any) => t.id === topicId);
          if (topic) {
            topic.lessons = topic.lessons.filter((l: any) => l.id.toString() !== lessonId.toString());
            break;
          }
        }
      }
      return nextSubjects;
    });
  };

  return (
    <SubjectsContext.Provider value={{ subjects, addLesson, deleteLesson, setTopicLessons }}>
      {children}
    </SubjectsContext.Provider>
  );
}

export function useSubjects() {
  const context = useContext(SubjectsContext);
  if (!context) {
    throw new Error('useSubjects must be used within a SubjectsProvider');
  }
  return context;
}

