export interface QuizOption {
  id: string;
  text: string;
  deafText?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  deafQuestion?: string;
  options: QuizOption[];
  correctOptionId: string;
  hint: string;
  deafHint?: string;
}

export interface Quiz {
  id: string;
  questions: QuizQuestion[];
}

export interface LessonContent {
  id: string;
  title: string;
  deafTitle?: string;
  description: string;
  descriptions?: string[];
  deafDescription?: string;
  deafDescriptions?: string[];
  tip?: string;
  deafTip?: string;
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  progress: number;
  icon: any;
  iconColor: string;
  bgColor: string;
  starsEarned: number;
  lessons: LessonContent[];
  quiz: Quiz;
}

export interface Category {
  name: string;
  topics: Topic[];
}

export interface Subject {
  id: string;
  name: string;
  categories: Category[];
}

export const subjectsData: Record<string, Subject> = {
  math: {
    id: 'math',
    name: 'Math',
    categories: [
      {
        name: 'Basics',
        topics: [
          {
            id: 'addition',
            name: 'Addition',
            description: 'Add numbers together',
            progress: 92,
            icon: 'add-outline',
            iconColor: '#7C3AED',
            bgColor: '#F3F4F6',
            starsEarned: 47,
            lessons: [
              {
                id: '1',
                title: 'Basic Addition',
                deafTitle: 'BASIC ADDITION',
                description: 'Addition means combining two or more numbers together.',
                deafDescription: 'ADDITION MEAN: TWO OR MORE NUMBERS PUT TOGETHER.',
                tip: 'Visual examples and interactive exercises help reinforce this concept.',
                deafTip: 'LOOK PICTURE AND PRACTICE HELPS UNDERSTAND MORE.'
              },
              {
                id: '2',
                title: 'Adding Large Numbers',
                deafTitle: 'ADDING BIG NUMBERS',
                description: 'When adding large numbers, line up the digits by place value.',
                deafDescription: 'BIG NUMBERS ADD? ALIGN DIGITS BY PLACE VALUE FIRST.',
                tip: 'Visual examples and interactive exercises help reinforce this concept.',
                deafTip: 'LOOK PICTURE AND PRACTICE HELPS UNDERSTAND MORE.'
              }
            ],
            quiz: {
              id: 'quiz_add_1',
              questions: [
                {
                  id: 'q1',
                  question: 'What is 5 + 3?',
                  deafQuestion: 'FIVE ADD THREE EQUALS WHAT? (5 + 3)',
                  options: [
                    { id: 'A', text: '6', deafText: '6' },
                    { id: 'B', text: '7', deafText: '7' },
                    { id: 'C', text: '8', deafText: '8' },
                    { id: 'D', text: '9', deafText: '9' }
                  ],
                  correctOptionId: 'C',
                  hint: 'Hold up 5 fingers, then count 3 more.',
                  deafHint: 'SHOW 5 FINGERS, THEN COUNT 3 MORE.'
                },
                {
                  id: 'q2',
                  question: 'What is 10 + 15?',
                  deafQuestion: 'TEN ADD FIFTEEN EQUALS WHAT? (10 + 15)',
                  options: [
                    { id: 'A', text: '20', deafText: '20' },
                    { id: 'B', text: '25', deafText: '25' },
                    { id: 'C', text: '30', deafText: '30' },
                    { id: 'D', text: '35', deafText: '35' }
                  ],
                  correctOptionId: 'B',
                  hint: 'Add the tens, then add the ones.',
                  deafHint: 'FIRST: ADD TENS. SECOND: ADD ONES.'
                },
                {
                  id: 'q3',
                  question: 'What is 12 + 8?',
                  deafQuestion: 'TWELVE ADD EIGHT EQUALS WHAT? (12 + 8)',
                  options: [
                    { id: 'A', text: '18', deafText: '18' },
                    { id: 'B', text: '19', deafText: '19' },
                    { id: 'C', text: '20', deafText: '20' },
                    { id: 'D', text: '21', deafText: '21' }
                  ],
                  correctOptionId: 'C',
                  hint: 'Think of number bonds to 10. 8 + 2 is 10.',
                  deafHint: 'THINK: EIGHT ADD TWO EQUALS TEN.'
                }
              ]
            }
          },
          {
            id: 'subtraction',
            name: 'Subtraction',
            description: 'Take away numbers',
            progress: 0,
            icon: 'remove-outline',
            iconColor: '#4F46E5',
            bgColor: '#EEF2FF',
            starsEarned: 0,
            lessons: [
              {
                id: '1',
                title: 'Basic Subtraction',
                deafTitle: 'BASIC SUBTRACTION',
                description: 'Subtraction means taking one number away from another.',
                deafDescription: 'SUBTRACTION MEAN: TAKE AWAY ONE NUMBER FROM OTHER.',
                tip: 'Think of it as counting backwards.',
                deafTip: 'THINK: COUNT BACKWARD.'
              }
            ],
            quiz: {
              id: 'quiz_sub_1',
              questions: [
                {
                  id: 'q1',
                  question: 'What is 10 - 4?',
                  deafQuestion: 'TEN TAKE AWAY FOUR EQUALS WHAT? (10 - 4)',
                  options: [
                    { id: 'A', text: '5', deafText: '5' },
                    { id: 'B', text: '6', deafText: '6' },
                    { id: 'C', text: '7', deafText: '7' },
                    { id: 'D', text: '8', deafText: '8' }
                  ],
                  correctOptionId: 'B',
                  hint: 'Count down 4 from 10.',
                  deafHint: 'COUNT DOWN 4 FROM 10.'
                }
              ]
            }
          },
          {
            id: 'multiplication',
            name: 'Multiplication',
            description: 'Times tables and more',
            progress: 88,
            icon: 'close-outline',
            iconColor: '#7C3AED',
            bgColor: '#F5F3FF',
            starsEarned: 24,
            lessons: [
              {
                id: '1',
                title: 'Introduction to Multiplication',
                deafTitle: 'INTRO TO MULTIPLICATION',
                description: 'Multiplication is like adding the same number many times.',
                deafDescription: 'MULTIPLICATION MEAN: ADD SAME NUMBER MANY TIMES.',
                tip: 'Use groups to help visualize.',
                deafTip: 'MAKE GROUPS FOR EASY LOOK.'
              }
            ],
            quiz: {
              id: 'quiz_mul_1',
              questions: [
                {
                  id: 'q1',
                  question: 'What is 3 x 4?',
                  deafQuestion: 'THREE TIMES FOUR EQUALS WHAT? (3 x 4)',
                  options: [
                    { id: 'A', text: '7', deafText: '7' },
                    { id: 'B', text: '10', deafText: '10' },
                    { id: 'C', text: '12', deafText: '12' },
                    { id: 'D', text: '14', deafText: '14' }
                  ],
                  correctOptionId: 'C',
                  hint: 'Add 4 three times: 4 + 4 + 4.',
                  deafHint: 'ADD 4 THREE TIMES (4 + 4 + 4).'
                }
              ]
            }
          },
          {
            id: 'division',
            name: 'Division',
            description: 'Split into equal parts',
            progress: 52,
            icon: 'ellipse-outline',
            iconColor: '#6366F1',
            bgColor: '#EEF2FF',
            starsEarned: 0,
            lessons: [
              {
                id: '1',
                title: 'Basic Division',
                deafTitle: 'BASIC DIVISION',
                description: 'Division means sharing equally into groups.',
                deafDescription: 'DIVISION MEAN: SHARE EQUALLY INTO GROUPS.',
                tip: 'Think of sharing a pizza among friends.',
                deafTip: 'IMAGINE: PIZZA SHARE EQUALLY WITH FRIENDS.'
              }
            ],
            quiz: {
              id: 'quiz_div_1',
              questions: [
                {
                  id: 'q1',
                  question: 'What is 10 divided by 2?',
                  deafQuestion: 'TEN DIVIDED BY TWO EQUALS WHAT? (10 / 2)',
                  options: [
                    { id: 'A', text: '2', deafText: '2' },
                    { id: 'B', text: '4', deafText: '4' },
                    { id: 'C', text: '5', deafText: '5' },
                    { id: 'D', text: '6', deafText: '6' }
                  ],
                  correctOptionId: 'C',
                  hint: 'If you have 10 apples and share them with a friend, how many do you each get?',
                  deafHint: 'HAVE 10 APPLES. SHARE 2 PEOPLE. EACH GET HOW MANY?'
                }
              ]
            }
          }
        ]
      },
      {
        name: 'Fundamentals',
        topics: [
          {
            id: 'fractions',
            name: 'Fractions',
            description: 'Learn parts of a whole',
            progress: 45,
            icon: 'pie-chart-outline',
            iconColor: '#F59E0B',
            bgColor: '#FEF3C7',
            starsEarned: 56,
            lessons: [
              {
                id: '1',
                title: 'What is a Fraction?',
                deafTitle: 'WHAT IS FRACTION?',
                description: 'A fraction represents a part of a whole.',
                deafDescription: 'FRACTION MEAN: ONE PART OF WHOLE OBJECT.',
                tip: 'The top number is the numerator, the bottom is the denominator.',
                deafTip: 'TOP NUMBER: NUMERATOR. BOTTOM NUMBER: DENOMINATOR.'
              }
            ],
            quiz: {
              id: 'quiz_frac_1',
              questions: [
                {
                  id: 'q1',
                  question: 'Which fraction is larger: 1/2 or 1/4?',
                  deafQuestion: 'WHICH FRACTION BIGGER: HALF (1/2) OR QUARTER (1/4)?',
                  options: [
                    { id: 'A', text: '1/2', deafText: '1/2' },
                    { id: 'B', text: '1/4', deafText: '1/4' },
                    { id: 'C', text: 'They are equal', deafText: 'THEY EQUAL' },
                    { id: 'D', text: 'Cannot tell', deafText: 'DON\'T KNOW' }
                  ],
                  correctOptionId: 'A',
                  hint: 'Think of half a pizza vs a quarter of a pizza.',
                  deafHint: 'THINK: PIZZA HALF VS PIZZA QUARTER.'
                }
              ]
            }
          },
          {
            id: 'decimals',
            name: 'Decimals',
            description: 'Numbers with decimal points',
            progress: 0,
            icon: 'calculator-outline',
            iconColor: '#0EA5E9',
            bgColor: '#E0F2FE',
            starsEarned: 0,
            lessons: [
              {
                id: '1',
                title: 'Understanding Decimals',
                deafTitle: 'UNDERSTANDING DECIMALS',
                description: 'Decimals are another way to write fractions.',
                deafDescription: 'DECIMALS MEAN: OTHER WAY WRITE FRACTION.',
                tip: 'Look at prices in a store, they use decimals!',
                deafTip: 'STORE PRICE USE DECIMAL. CHECK NOW!'
              }
            ],
            quiz: {
              id: 'quiz_dec_1',
              questions: [
                {
                  id: 'q1',
                  question: 'What is 0.5 + 0.5?',
                  deafQuestion: '0.5 ADD 0.5 EQUALS WHAT?',
                  options: [
                    { id: 'A', text: '0.10', deafText: '0.10' },
                    { id: 'B', text: '1.0', deafText: '1.0' },
                    { id: 'C', text: '0.0', deafText: '0.0' },
                    { id: 'D', text: '10', deafText: '10' }
                  ],
                  correctOptionId: 'B',
                  hint: 'Think of 50 cents plus 50 cents.',
                  deafHint: 'THINK: 50 CENTS ADD 50 CENTS.'
                }
              ]
            }
          },
          {
            id: 'percentages',
            name: 'Percentages',
            description: 'Parts per hundred',
            progress: 0,
            icon: 'pricetag-outline',
            iconColor: '#EF4444',
            bgColor: '#FEE2E2',
            starsEarned: 0,
            lessons: [
              {
                id: '1',
                title: 'Introduction to Percentages',
                deafTitle: 'INTRO TO PERCENTAGES',
                description: 'Percent means "out of 100".',
                deafDescription: 'PERCENT MEAN: OUT OF ONE HUNDRED (100).',
                tip: '100% means the whole thing.',
                deafTip: 'HUNDRED PERCENT (100%) MEAN WHOLE THING.'
              }
            ],
            quiz: {
              id: 'quiz_perc_1',
              questions: [
                {
                  id: 'q1',
                  question: 'What is 50% as a fraction?',
                  deafQuestion: 'FIFTY PERCENT (50%) SAME WHICH FRACTION?',
                  options: [
                    { id: 'A', text: '1/4', deafText: '1/4' },
                    { id: 'B', text: '1/3', deafText: '1/3' },
                    { id: 'C', text: '1/2', deafText: '1/2' },
                    { id: 'D', text: '3/4', deafText: '3/4' }
                  ],
                  correctOptionId: 'C',
                  hint: '50 out of 100 is half.',
                  deafHint: 'FIFTY OUT OF HUNDRED MEANS HALF.'
                }
              ]
            }
          }
        ]
      }
    ]
  },
  english: {
    id: 'english',
    name: 'English',
    categories: [
      {
        name: 'English Modules',
        topics: [
          {
            id: 'story-grammar',
            name: 'Story Grammar',
            description: 'Master story elements, characters, settings, plots, and narrative comprehension.',
            progress: 0,
            icon: 'book-outline',
            iconColor: '#7C3AED',
            bgColor: '#EDE9FE',
            starsEarned: 0,
            lessons: [],
            quiz: {
              id: 'quiz_story_grammar',
              questions: []
            }
          },
          {
            id: 'english-literacy',
            name: 'English Literacy',
            description: 'Enhance reading comprehension, vocabulary, and sentence structures.',
            progress: 0,
            icon: 'reader-outline',
            iconColor: '#0284C7',
            bgColor: '#E0F2FE',
            starsEarned: 0,
            lessons: [],
            quiz: {
              id: 'quiz_english_literacy',
              questions: []
            }
          }
        ]
      }
    ]
  },
  filipino: {
    id: 'filipino',
    name: 'Filipino',
    categories: [
      {
        name: 'Wika',
        topics: [
          {
            id: 'pandandiwa',
            name: 'Pandandiwa',
            description: 'Salitang kilos',
            progress: 30,
            icon: 'walk-outline',
            iconColor: '#10B981',
            bgColor: '#D1FAE5',
            starsEarned: 15,
            lessons: [
              {
                id: '1',
                title: 'Ano ang Pandiwa?',
                deafTitle: 'ANO ANG PANDIWA? (VERB)',
                description: 'Ang pandiwa ay nagsasaad ng kilos o galaw.',
                deafDescription: 'PANDIWA (VERB) MEAN: ACTION OR MOVE WORD.',
                tip: 'Halimbawa: takbo, talon, kain.',
                deafTip: 'EXAMPLE: RUN, JUMP, EAT.'
              }
            ],
            quiz: {
              id: 'quiz_pandiwa_1',
              questions: [
                {
                  id: 'q1',
                  question: 'Alin ang pandiwa sa pangungusap: "Tumakbo ang aso."',
                  deafQuestion: 'PANGUNGUSAP "TUMAKBO ANG ASO" - ALIN ANG PANDIWA (VERB)?',
                  options: [
                    { id: 'A', text: 'Tumakbo', deafText: 'Tumakbo (Run)' },
                    { id: 'B', text: 'ang', deafText: 'ang (the)' },
                    { id: 'C', text: 'aso', deafText: 'aso (dog)' },
                    { id: 'D', text: 'wala', deafText: 'wala (none)' }
                  ],
                  correctOptionId: 'A',
                  hint: 'Hanapin ang salitang nagsasaad ng kilos.',
                  deafHint: 'FIND WORD THAT SHOW ACTION/MOVEMENT.'
                }
              ]
            }
          }
        ]
      }
    ]
  }
};
