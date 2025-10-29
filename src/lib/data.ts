// TEMPORARY DATA

export type Role = "admin" | "teacher" | "student" | "parent";

export type School = {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  principal: string;
  established: string;
  logo?: string;
};

export const schoolsData: School[] = [
  {
    id: "central",
    name: "Central Campus",
    code: "BC-CEN",
    address: "12 Unity Road",
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    phone: "+234-700-000-001",
    email: "central@bishopcrowther.edu.ng",
    principal: "Grace Ajayi",
    established: "2005",
    logo: "/logos/central.png",
  },
  {
    id: "downtown",
    name: "Downtown Campus",
    code: "BC-DWN",
    address: "48 King Street",
    city: "Abuja",
    state: "FCT",
    country: "Nigeria",
    phone: "+234-700-000-002",
    email: "downtown@bishopcrowther.edu.ng",
    principal: "Emeka Balogun",
    established: "2010",
    logo: "/logos/downtown.png",
  },
  {
    id: "lakeside",
    name: "Lakeside Campus",
    code: "BC-LAK",
    address: "3 River Close",
    city: "Port Harcourt",
    state: "Rivers",
    country: "Nigeria",
    phone: "+234-700-000-003",
    email: "lakeside@bishopcrowther.edu.ng",
    principal: "Ngozi Peters",
    established: "2014",
    logo: "/logos/lakeside.png",
  },
];

const fallbackSchoolId = schoolsData[0]?.id ?? "central";

const assignSchoolId = <T extends { id: number; schoolId?: string }>(items: T[]): Array<T & { schoolId: string }> => {
  return items.map((item) => {
    if (item.schoolId) {
      return { ...item, schoolId: item.schoolId } as T & { schoolId: string };
    }

    const index = Math.abs((item.id ?? 1) - 1) % schoolsData.length;
    const school = schoolsData[index] ?? schoolsData[0];

    return { ...item, schoolId: school.id };
  });
};

const fallbackSchool = schoolsData[0];
const fallbackSchoolMeta = {
  schoolId: fallbackSchool?.id ?? "default",
  schoolName: fallbackSchool?.name ?? "School",
};

export const getSchoolById = (schoolId: string): School | undefined =>
  schoolsData.find((school) => school.id === schoolId);

export const getSchoolMetaForId = (schoolId?: string) => {
  if (!schoolId) {
    return fallbackSchoolMeta;
  }

  const school = getSchoolById(schoolId);
  return {
    schoolId: school?.id ?? fallbackSchoolMeta.schoolId,
    schoolName: school?.name ?? fallbackSchoolMeta.schoolName,
  };
};

export const currentUser = {
  id: 1,
  name: "John Doe",
  role: "admin" as const,
  schoolId: fallbackSchoolId,
  managedSchoolIds: schoolsData.map((school) => school.id),
};

export let role = currentUser.role;

const teacherSeed = [
  {
    id: 1,
    teacherId: "1234567890",
    name: "John Doe",
    email: "john@doe.com",
    photo:
      "https://images.pexels.com/photos/2888150/pexels-photo-2888150.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567890",
    subjects: ["Math", "Geometry"],
    classes: ["1B", "2A", "3C"],
    address: "123 Main St, Anytown, USA",
  },
  {
    id: 2,
    teacherId: "1234567890",
    name: "Jane Doe",
    email: "jane@doe.com",
    photo:
      "https://images.pexels.com/photos/936126/pexels-photo-936126.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567890",
    subjects: ["Physics", "Chemistry"],
    classes: ["5A", "4B", "3C"],
    address: "123 Main St, Anytown, USA",
  },
  {
    id: 3,
    teacherId: "1234567890",
    name: "Mike Geller",
    email: "mike@geller.com",
    photo:
      "https://images.pexels.com/photos/428328/pexels-photo-428328.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567890",
    subjects: ["Biology"],
    classes: ["5A", "4B", "3C"],
    address: "123 Main St, Anytown, USA",
  },
  {
    id: 4,
    teacherId: "1234567890",
    name: "Jay French",
    email: "jay@gmail.com",
    photo:
      "https://images.pexels.com/photos/1187765/pexels-photo-1187765.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567890",
    subjects: ["History"],
    classes: ["5A", "4B", "3C"],
    address: "123 Main St, Anytown, USA",
  },
  {
    id: 5,
    teacherId: "1234567890",
    name: "Jane Smith",
    email: "jane@gmail.com",
    photo:
      "https://images.pexels.com/photos/1102341/pexels-photo-1102341.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567890",
    subjects: ["Music", "History"],
    classes: ["5A", "4B", "3C"],
    address: "123 Main St, Anytown, USA",
  },
  {
    id: 6,
    teacherId: "1234567890",
    name: "Anna Santiago",
    email: "anna@gmail.com",
    photo:
      "https://images.pexels.com/photos/712513/pexels-photo-712513.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567890",
    subjects: ["Physics"],
    classes: ["5A", "4B", "3C"],
    address: "123 Main St, Anytown, USA",
  },
  {
    id: 7,
    teacherId: "1234567890",
    name: "Allen Black",
    email: "allen@black.com",
    photo:
      "https://images.pexels.com/photos/1438081/pexels-photo-1438081.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567890",
    subjects: ["English", "Spanish"],
    classes: ["5A", "4B", "3C"],
    address: "123 Main St, Anytown, USA",
  },
  {
    id: 8,
    teacherId: "1234567890",
    name: "Ophelia Castro",
    email: "ophelia@castro.com",
    photo:
      "https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567890",
    subjects: ["Math", "Geometry"],
    classes: ["5A", "4B", "3C"],
    address: "123 Main St, Anytown, USA",
  },
  {
    id: 9,
    teacherId: "1234567890",
    name: "Derek Briggs",
    email: "derek@briggs.com",
    photo:
      "https://images.pexels.com/photos/842980/pexels-photo-842980.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567890",
    subjects: ["Literature", "English"],
    classes: ["5A", "4B", "3C"],
    address: "123 Main St, Anytown, USA",
  },
  {
    id: 10,
    teacherId: "1234567890",
    name: "John Glover",
    email: "john@glover.com",
    photo:
      "https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567890",
    subjects: ["Biology"],
    classes: ["5A", "4B", "3C"],
    address: "123 Main St, Anytown, USA",
  },
];

export const teachersData = assignSchoolId(teacherSeed);

const studentSeed = [
  {
    id: 1,
    studentId: "1234567890",
    name: "John Doe",
    email: "john@doe.com",
    photo:
      "https://images.pexels.com/photos/2888150/pexels-photo-2888150.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567890",
    grade: 5,
    class: "1B",
    address: "123 Main St, Anytown, USA",
    category: "Science",
    guardianName: "Samuel Doe",
    guardianPhone: "555-0101",
  },
  {
    id: 2,
    studentId: "1234567891",
    name: "Jane Doe",
    email: "jane@doe.com",
    photo:
      "https://images.pexels.com/photos/936126/pexels-photo-936126.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567891",
    grade: 5,
    class: "5A",
    address: "123 Main St, Anytown, USA",
    category: "Art",
    guardianName: "Peter Doe",
    guardianPhone: "555-0102",
  },
  {
    id: 3,
    studentId: "1234567892",
    name: "Mike Geller",
    email: "mike@geller.com",
    photo:
      "https://images.pexels.com/photos/428328/pexels-photo-428328.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567892",
    grade: 5,
    class: "5A",
    address: "123 Main St, Anytown, USA",
    category: "Humanities",
    guardianName: "Laura Geller",
    guardianPhone: "555-0103",
  },
  {
    id: 4,
    studentId: "1234567893",
    name: "Jay French",
    email: "jay@gmail.com",
    photo:
      "https://images.pexels.com/photos/1187765/pexels-photo-1187765.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567893",
    grade: 5,
    class: "5A",
    address: "123 Main St, Anytown, USA",
    category: "Commercial",
    guardianName: "Lara French",
    guardianPhone: "555-0104",
  },
  {
    id: 5,
    studentId: "1234567894",
    name: "Jane Smith",
    email: "jane@gmail.com",
    photo:
      "https://images.pexels.com/photos/1102341/pexels-photo-1102341.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567894",
    grade: 5,
    class: "5A",
    address: "123 Main St, Anytown, USA",
    category: "Technical",
    guardianName: "George Smith",
    guardianPhone: "555-0105",
  },
  {
    id: 6,
    studentId: "1234567895",
    name: "Anna Santiago",
    email: "anna@gmail.com",
    photo:
      "https://images.pexels.com/photos/712513/pexels-photo-712513.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567895",
    grade: 5,
    class: "5A",
    address: "123 Main St, Anytown, USA",
    category: "Science",
    guardianName: "Paula Santiago",
    guardianPhone: "555-0106",
  },
  {
    id: 7,
    studentId: "1234567896",
    name: "Allen Black",
    email: "allen@black.com",
    photo:
      "https://images.pexels.com/photos/1438081/pexels-photo-1438081.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567896",
    grade: 5,
    class: "5A",
    address: "123 Main St, Anytown, USA",
    category: "Humanities",
    guardianName: "Michelle Black",
    guardianPhone: "555-0107",
  },
  {
    id: 8,
    studentId: "1234567897",
    name: "Ophelia Castro",
    email: "ophelia@castro.com",
    photo:
      "https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567897",
    grade: 5,
    class: "5A",
    address: "123 Main St, Anytown, USA",
    category: "Science",
    guardianName: "Victor Castro",
    guardianPhone: "555-0108",
  },
  {
    id: 9,
    studentId: "1234567898",
    name: "Derek Briggs",
    email: "derek@briggs.com",
    photo:
      "https://images.pexels.com/photos/842980/pexels-photo-842980.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567898",
    grade: 5,
    class: "5A",
    address: "123 Main St, Anytown, USA",
    category: "Art",
    guardianName: "Zoe Briggs",
    guardianPhone: "555-0109",
  },
  {
    id: 10,
    studentId: "1234567899",
    name: "John Glover",
    email: "john@glover.com",
    photo:
      "https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "1234567899",
    grade: 5,
    class: "5A",
    address: "123 Main St, Anytown, USA",
    category: "General",
    guardianName: "Rachel Glover",
    guardianPhone: "555-0110",
  },
  {
    id: 11,
    studentId: "2001001",
    name: "Adaobi Johnson",
    email: "adaobi.johnson@example.com",
    photo: "https://images.pexels.com/photos/620351/pexels-photo-620351.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "08030000001",
    grade: 10,
    class: "SS1 A",
    address: "25 Unity Crescent, Lagos",
    category: "Science",
    guardianName: "Chioma Johnson",
    guardianPhone: "555-0201",
  },
  {
    id: 12,
    studentId: "2001002",
    name: "Ifeanyi Lawson",
    email: "ifeanyi.lawson@example.com",
    photo: "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "08030000002",
    grade: 10,
    class: "SS1 A",
    address: "42 Palm Avenue, Lagos",
    category: "Science",
    guardianName: "Valentine Lawson",
    guardianPhone: "555-0202",
  },
  {
    id: 13,
    studentId: "2002001",
    name: "Zainab Okonkwo",
    email: "zainab.okonkwo@example.com",
    photo: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "08030000003",
    grade: 11,
    class: "SS2 C",
    address: "18 Marina Road, Abuja",
    category: "Science",
    guardianName: "Halima Okonkwo",
    guardianPhone: "555-0203",
  },
  {
    id: 14,
    studentId: "2002002",
    name: "Chiamaka Umeh",
    email: "chiamaka.umeh@example.com",
    photo: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=1200",
    phone: "08030000004",
    grade: 11,
    class: "SS2 C",
    address: "7 Independence Layout, Enugu",
    category: "Science",
    guardianName: "Obinna Umeh",
    guardianPhone: "555-0204",
  },
];

export const studentsData = assignSchoolId(studentSeed);

const parentSeed = [
  {
    id: 1,
    name: "Chioma Johnson",
    students: ["Adaobi Johnson"],
    email: "chioma.johnson@parents.ng",
    phone: "+234-803-555-2101",
    address: "25 Unity Crescent, Lagos",
  },
  {
    id: 2,
    name: "Valentine Lawson",
    students: ["Ifeanyi Lawson"],
    email: "valentine.lawson@parents.ng",
    phone: "+234-803-555-2102",
    address: "42 Palm Avenue, Lagos",
  },
  {
    id: 3,
    name: "Amina Okonkwo",
    students: ["Zainab Okonkwo"],
    email: "amina.okonkwo@parents.ng",
    phone: "+234-803-555-3103",
    address: "18 Garden City Way, Port Harcourt",
  },
  {
    id: 4,
    name: "Obinna Umeh",
    students: ["Chiamaka Umeh"],
    email: "obinna.umeh@parents.ng",
    phone: "+234-803-555-4104",
    address: "7 Independence Layout, Enugu",
  },
  {
    id: 5,
    name: "Samuel Doe",
    students: ["John Doe", "Jane Doe"],
    email: "samuel.doe@example.com",
    phone: "+234-803-555-1105",
    address: "12 Unity Road, Lagos",
  },
  {
    id: 6,
    name: "Paula Santiago",
    students: ["Anna Santiago"],
    email: "paula.santiago@example.com",
    phone: "+234-803-555-1106",
    address: "9 Marina Drive, Lagos",
  },
  {
    id: 7,
    name: "Michelle Black",
    students: ["Allen Black"],
    email: "michelle.black@example.com",
    phone: "+234-803-555-1107",
    address: "45 Kings Close, Abuja",
  },
  {
    id: 8,
    name: "Victor Castro",
    students: ["Ophelia Castro"],
    email: "victor.castro@example.com",
    phone: "+234-803-555-1108",
    address: "13 Creek View, Port Harcourt",
  },
  {
    id: 9,
    name: "Zoe Briggs",
    students: ["Derek Briggs"],
    email: "zoe.briggs@example.com",
    phone: "+234-803-555-1109",
    address: "4 Bridge Lane, Lagos",
  },
  {
    id: 10,
    name: "Rachel Glover",
    students: ["John Glover"],
    email: "rachel.glover@example.com",
    phone: "+234-803-555-1110",
    address: "33 Palm Crest, Abuja",
  },
  {
    id: 11,
    name: "George Smith",
    students: ["Jane Smith"],
    email: "george.smith@example.com",
    phone: "+234-803-555-1111",
    address: "28 Pine Estate, Lagos",
  },
  {
    id: 12,
    name: "Laura Geller",
    students: ["Mike Geller"],
    email: "laura.geller@example.com",
    phone: "+234-803-555-1112",
    address: "19 Orchard Street, Lagos",
  },
  {
    id: 13,
    name: "Lara French",
    students: ["Jay French"],
    email: "lara.french@example.com",
    phone: "+234-803-555-1113",
    address: "22 Horizon Avenue, Abuja",
  },
];

export const parentsData = assignSchoolId(parentSeed);

const subjectSeed = [
  {
    id: 1,
    name: "Mathematics",
    code: "MTH-101",
    category: "STEM",
    creditHours: 4,
    description: "Foundational algebra and numeracy skills.",
    classIds: [1, 3, 4, 5, 6, 9],
  },
  {
    id: 2,
    name: "English Language",
    code: "ENG-101",
    category: "Language",
    creditHours: 3,
    description: "Reading comprehension, grammar, and composition.",
    classIds: [1, 2, 3, 4, 7, 10],
  },
  {
    id: 3,
    name: "Basic Science",
    code: "SCI-201",
    category: "STEM",
    creditHours: 3,
    description: "Introductory biology, physics, and chemistry concepts.",
    classIds: [3, 4, 5, 6],
  },
  {
    id: 4,
    name: "Civic Education",
    code: "CIV-105",
    category: "Humanities",
    creditHours: 2,
    description: "Citizenship, leadership, and social values.",
    classIds: [1, 2, 3, 4, 5],
  },
  {
    id: 5,
    name: "Chemistry",
    code: "CHM-305",
    category: "STEM",
    creditHours: 4,
    description: "Organic and inorganic chemistry foundations.",
    classIds: [6, 9],
  },
  {
    id: 6,
    name: "Physics",
    code: "PHY-302",
    category: "STEM",
    creditHours: 4,
    description: "Mechanics, waves, and electricity.",
    classIds: [6, 9],
  },
  {
    id: 7,
    name: "Biology",
    code: "BIO-301",
    category: "STEM",
    creditHours: 3,
    description: "Cell biology, ecology, and human anatomy.",
    classIds: [6, 9],
  },
  {
    id: 8,
    name: "Government",
    code: "GOV-402",
    category: "Humanities",
    creditHours: 3,
    description: "Political structure and civic processes.",
    classIds: [8, 10],
  },
  {
    id: 9,
    name: "Financial Accounting",
    code: "ACC-401",
    category: "Commercial",
    creditHours: 3,
    description: "Bookkeeping and corporate finance basics.",
    classIds: [8],
  },
  {
    id: 10,
    name: "Literature in English",
    code: "LIT-302",
    category: "Language",
    creditHours: 3,
    description: "African and world literature analysis.",
    classIds: [7, 10],
  },
];

export const subjectsData = assignSchoolId(subjectSeed);

const classSeed = [
  {
    id: 1,
    name: "Year 1 - Blue",
    code: "YR1-BLU",
    category: "Lower Primary",
    section: "Blue",
    grade: 1,
    capacity: 24,
    room: "A1",
    supervisor: "Joseph Padilla",
  },
  {
    id: 2,
    name: "Year 1 - Gold",
    code: "YR1-GLD",
    category: "Lower Primary",
    section: "Gold",
    grade: 1,
    capacity: 24,
    room: "A2",
    supervisor: "Leila Santos",
  },
  {
    id: 3,
    name: "Year 2 - Maple",
    code: "YR2-MAP",
    category: "Lower Primary",
    section: "Maple",
    grade: 2,
    capacity: 26,
    room: "B1",
    supervisor: "Blake Joseph",
  },
  {
    id: 4,
    name: "JSS 1 - Emerald",
    code: "JSS1-EMD",
    category: "Junior Secondary",
    section: "Emerald",
    grade: 7,
    capacity: 28,
    room: "C1",
    supervisor: "Carrie Walton",
  },
  {
    id: 5,
    name: "JSS 2 - Ruby",
    code: "JSS2-RBY",
    category: "Junior Secondary",
    section: "Ruby",
    grade: 8,
    capacity: 30,
    room: "C2",
    supervisor: "Tom Bennett",
  },
  {
    id: 6,
    name: "SSS 1 - Science",
    code: "SSS1-SCI",
    category: "Senior Secondary (Science)",
    section: "Science",
    grade: 10,
    capacity: 32,
    room: "D1",
    supervisor: "Ngozi Peters",
  },
  {
    id: 7,
    name: "SSS 1 - Arts",
    code: "SSS1-ART",
    category: "Senior Secondary (Arts)",
    section: "Arts",
    grade: 10,
    capacity: 30,
    room: "D2",
    supervisor: "Marc Miller",
  },
  {
    id: 8,
    name: "SSS 2 - Commerce",
    code: "SSS2-COM",
    category: "Senior Secondary (Commercial)",
    section: "Commerce",
    grade: 11,
    capacity: 30,
    room: "D3",
    supervisor: "Ophelia Marsh",
  },
  {
    id: 9,
    name: "SSS 3 - Science",
    code: "SSS3-SCI",
    category: "Senior Secondary (Science)",
    section: "Science",
    grade: 12,
    capacity: 28,
    room: "E1",
    supervisor: "Christopher Butler",
  },
  {
    id: 10,
    name: "SSS 3 - Arts",
    code: "SSS3-ART",
    category: "Senior Secondary (Arts)",
    section: "Arts",
    grade: 12,
    capacity: 26,
    room: "E2",
    supervisor: "Aaron Collins",
  },
];

export const classesData = assignSchoolId(classSeed);

export const lessonsData = [
  {
    id: 1,
    subject: "Math",
    class: "1A",
    teacher: "Tommy Wise",
  },
  {
    id: 2,
    subject: "English",
    class: "2A",
    teacher: "Rhoda Frank",
  },
  {
    id: 3,
    subject: "Science",
    class: "3A",
    teacher: "Della Dunn",
  },
  {
    id: 4,
    subject: "Social Studies",
    class: "1B",
    teacher: "Bruce Rodriguez",
  },
  {
    id: 5,
    subject: "Art",
    class: "4A",
    teacher: "Birdie Butler",
  },
  {
    id: 6,
    subject: "Music",
    class: "5A",
    teacher: "Bettie Oliver",
  },
  {
    id: 7,
    subject: "History",
    class: "6A",
    teacher: "Herman Howard",
  },
  {
    id: 8,
    subject: "Geography",
    class: "6B",
    teacher: "Lucinda Thomas",
  },
  {
    id: 9,
    subject: "Physics",
    class: "6C",
    teacher: "Ronald Roberts",
  },
  {
    id: 10,
    subject: "Chemistry",
    class: "4B",
    teacher: "Julia Pittman",
  },
];

export type ExamSchedule = {
  id: number;
  examDate: string;
  assessmentWindow: string;
  schoolId: string;
  sessionId: string;
  examType: "midterm" | "final";
  term: "First Term" | "Second Term" | "Third Term";
};

export const examsData: ExamSchedule[] = [
  {
    id: 1,
    examDate: "2025-02-24",
    assessmentWindow: "Weeks 8 - 9",
    schoolId: "central",
    sessionId: "2024-2025",
    examType: "final",
    term: "Second Term",
  },
  {
    id: 2,
    examDate: "2025-01-26",
    assessmentWindow: "Weeks 4 - 5",
    schoolId: "central",
    sessionId: "2024-2025",
    examType: "midterm",
    term: "Second Term",
  },
  {
    id: 3,
    examDate: "2025-02-26",
    assessmentWindow: "Weeks 8 - 9",
    schoolId: "downtown",
    sessionId: "2024-2025",
    examType: "final",
    term: "Second Term",
  },
  {
    id: 4,
    examDate: "2025-01-28",
    assessmentWindow: "Week 5",
    schoolId: "downtown",
    sessionId: "2024-2025",
    examType: "midterm",
    term: "Second Term",
  },
  {
    id: 5,
    examDate: "2025-03-15",
    assessmentWindow: "Week 11",
    schoolId: "central",
    sessionId: "2024-2025",
    examType: "final",
    term: "Third Term",
  },
];

export const assignmentsData = [
  {
    id: 1,
    subject: "Math",
    class: "1A",
    teacher: "Anthony Boone",
    dueDate: "2025-01-01",
  },
  {
    id: 2,
    subject: "English",
    class: "2A",
    teacher: "Clifford Bowen",
    dueDate: "2025-01-01",
  },
  {
    id: 3,
    subject: "Science",
    class: "3A",
    teacher: "Catherine Malone",
    dueDate: "2025-01-01",
  },
  {
    id: 4,
    subject: "Social Studies",
    class: "1B",
    teacher: "Willie Medina",
    dueDate: "2025-01-01",
  },
  {
    id: 5,
    subject: "Art",
    class: "4A",
    teacher: "Jose Ruiz",
    dueDate: "2025-01-01",
  },
  {
    id: 6,
    subject: "Music",
    class: "5A",
    teacher: "Katharine Owens",
    dueDate: "2025-01-01",
  },
  {
    id: 7,
    subject: "History",
    class: "6A",
    teacher: "Shawn Norman",
    dueDate: "2025-01-01",
  },
  {
    id: 8,
    subject: "Geography",
    class: "6B",
    teacher: "Don Holloway",
    dueDate: "2025-01-01",
  },
  {
    id: 9,
    subject: "Physics",
    class: "7A",
    teacher: "Franklin Gregory",
    dueDate: "2025-01-01",
  },
  {
    id: 10,
    subject: "Chemistry",
    class: "8A",
    teacher: "Danny Nguyen",
    dueDate: "2025-01-01",
  },
];

export const resultsData = [
  {
    id: 1,
    subject: "Math",
    class: "1A",
    teacher: "John Doe",
    student: "John Doe",
    date: "2025-01-01",
    type: "exam",
    score: 90,
  },
  {
    id: 2,
    subject: "English",
    class: "2A",
    teacher: "John Doe",
    student: "John Doe",
    date: "2025-01-01",
    type: "exam",
    score: 90,
  },
  {
    id: 3,
    subject: "Science",
    class: "3A",
    teacher: "John Doe",
    student: "John Doe",
    date: "2025-01-01",
    type: "exam",
    score: 90,
  },
  {
    id: 4,
    subject: "Social Studies",
    class: "1B",
    teacher: "John Doe",
    student: "John Doe",
    date: "2025-01-01",
    type: "exam",
    score: 90,
  },
  {
    id: 5,
    subject: "Art",
    class: "4A",
    teacher: "John Doe",
    student: "John Doe",
    date: "2025-01-01",
    type: "exam",
    score: 90,
  },
  {
    id: 6,
    subject: "Music",
    class: "5A",
    teacher: "John Doe",
    student: "John Doe",
    date: "2025-01-01",
    type: "exam",
    score: 90,
  },
  {
    id: 7,
    subject: "History",
    class: "6A",
    teacher: "John Doe",
    student: "John Doe",
    date: "2025-01-01",
    type: "exam",
    score: 90,
  },
  {
    id: 8,
    subject: "Geography",
    class: "6B",
    teacher: "John Doe",
    student: "John Doe",
    date: "2025-01-01",
    type: "exam",
    score: 90,
  },
  {
    id: 9,
    subject: "Physics",
    class: "7A",
    teacher: "John Doe",
    student: "John Doe",
    date: "2025-01-01",
    type: "exam",
    score: 90,
  },
  {
    id: 10,
    subject: "Chemistry",
    class: "8A",
    teacher: "John Doe",
    student: "John Doe",
    date: "2025-01-01",
    type: "exam",
    score: 90,
  },
  {
    id: 11,
    subject: "Mathematics",
    class: "SS1 A",
    teacher: "Grace Ajayi",
    student: "Adaobi Johnson",
    date: "2025-01-12",
    type: "final",
    score: 89,
  },
  {
    id: 12,
    subject: "English Language",
    class: "SS1 A",
    teacher: "David James",
    student: "Adaobi Johnson",
    date: "2025-01-18",
    type: "final",
    score: 92,
  },
  {
    id: 13,
    subject: "Biology",
    class: "SS1 A",
    teacher: "Ngozi Peters",
    student: "Adaobi Johnson",
    date: "2025-01-22",
    type: "test",
    score: 88,
  },
  {
    id: 14,
    subject: "Mathematics",
    class: "SS1 A",
    teacher: "Grace Ajayi",
    student: "Ifeanyi Lawson",
    date: "2025-01-12",
    type: "final",
    score: 84,
  },
  {
    id: 15,
    subject: "English Language",
    class: "SS1 A",
    teacher: "David James",
    student: "Ifeanyi Lawson",
    date: "2025-01-18",
    type: "final",
    score: 87,
  },
  {
    id: 16,
    subject: "Chemistry",
    class: "SS1 A",
    teacher: "Ngozi Peters",
    student: "Ifeanyi Lawson",
    date: "2025-01-23",
    type: "test",
    score: 82,
  },
  {
    id: 17,
    subject: "Physics",
    class: "SS2 C",
    teacher: "Ngozi Peters",
    student: "Zainab Okonkwo",
    date: "2025-01-12",
    type: "final",
    score: 94,
  },
  {
    id: 18,
    subject: "Chemistry",
    class: "SS2 C",
    teacher: "Ngozi Peters",
    student: "Zainab Okonkwo",
    date: "2025-01-18",
    type: "final",
    score: 96,
  },
  {
    id: 19,
    subject: "Further Mathematics",
    class: "SS2 C",
    teacher: "Grace Ajayi",
    student: "Zainab Okonkwo",
    date: "2025-01-24",
    type: "test",
    score: 93,
  },
  {
    id: 20,
    subject: "Physics",
    class: "SS2 C",
    teacher: "Ngozi Peters",
    student: "Chiamaka Umeh",
    date: "2025-01-12",
    type: "final",
    score: 78,
  },
  {
    id: 21,
    subject: "Chemistry",
    class: "SS2 C",
    teacher: "Ngozi Peters",
    student: "Chiamaka Umeh",
    date: "2025-01-18",
    type: "final",
    score: 74,
  },
  {
    id: 22,
    subject: "Biology",
    class: "SS2 C",
    teacher: "Ngozi Peters",
    student: "Chiamaka Umeh",
    date: "2025-01-24",
    type: "test",
    score: 79,
  },
];

export const eventsData = [
  {
    id: 1,
    title: "Lake Trip",
    class: "1A",
    date: "2025-01-01",
    startTime: "10:00",
    endTime: "11:00",
  },
  {
    id: 2,
    title: "Picnic",
    class: "2A",
    date: "2025-01-01",
    startTime: "10:00",
    endTime: "11:00",
  },
  {
    id: 3,
    title: "Beach Trip",
    class: "3A",
    date: "2025-01-01",
    startTime: "10:00",
    endTime: "11:00",
  },
  {
    id: 4,
    title: "Museum Trip",
    class: "4A",
    date: "2025-01-01",
    startTime: "10:00",
    endTime: "11:00",
  },
  {
    id: 5,
    title: "Music Concert",
    class: "5A",
    date: "2025-01-01",
    startTime: "10:00",
    endTime: "11:00",
  },
  {
    id: 6,
    title: "Magician Show",
    class: "1B",
    date: "2025-01-01",
    startTime: "10:00",
    endTime: "11:00",
  },
  {
    id: 7,
    title: "Lake Trip",
    class: "2B",
    date: "2025-01-01",
    startTime: "10:00",
    endTime: "11:00",
  },
  {
    id: 8,
    title: "Cycling Race",
    class: "3B",
    date: "2025-01-01",
    startTime: "10:00",
    endTime: "11:00",
  },
  {
    id: 9,
    title: "Art Exhibition",
    class: "4B",
    date: "2025-01-01",
    startTime: "10:00",
    endTime: "11:00",
  },
  {
    id: 10,
    title: "Sports Tournament",
    class: "5B",
    date: "2025-01-01",
    startTime: "10:00",
    endTime: "11:00",
  },
];

export const announcementsData = [
  {
    id: 1,
    title: "About 4A Math Test",
    class: "4A",
    date: "2025-01-01",
  },
  {
    id: 2,
    title: "About 3A Math Test",
    class: "3A",
    date: "2025-01-01",
  },
  {
    id: 3,
    title: "About 3B Math Test",
    class: "3B",
    date: "2025-01-01",
  },
  {
    id: 4,
    title: "About 6A Math Test",
    class: "6A",
    date: "2025-01-01",
  },
  {
    id: 5,
    title: "About 8C Math Test",
    class: "8C",
    date: "2025-01-01",
  },
  {
    id: 6,
    title: "About 2A Math Test",
    class: "2A",
    date: "2025-01-01",
  },
  {
    id: 7,
    title: "About 4C Math Test",
    class: "4C",
    date: "2025-01-01",
  },
  {
    id: 8,
    title: "About 4B Math Test",
    class: "4B",
    date: "2025-01-01",
  },
  {
    id: 9,
    title: "About 3C Math Test",
    class: "3C",
    date: "2025-01-01",
  },
  {
    id: 10,
    title: "About 1C Math Test",
    class: "1C",
    date: "2025-01-01",
  },
];


// YOU SHOULD CHANGE THE DATES OF THE EVENTS TO THE CURRENT DATE TO SEE THE EVENTS ON THE CALENDAR
export const calendarEvents = [
  {
    title: "Math",
    allDay: false,
    start: new Date(2024, 7, 12, 8, 0),
    end: new Date(2024, 7, 12, 8, 45),
  },
  {
    title: "English",
    allDay: false,
    start: new Date(2024, 7, 12, 9, 0),
    end: new Date(2024, 7, 12, 9, 45),
  },
  {
    title: "Biology",
    allDay: false,
    start: new Date(2024, 7, 12, 10, 0),
    end: new Date(2024, 7, 12, 10, 45),
  },
  {
    title: "Physics",
    allDay: false,
    start: new Date(2024, 7, 12, 11, 0),
    end: new Date(2024, 7, 12, 11, 45),
  },
  {
    title: "Chemistry",
    allDay: false,
    start: new Date(2024, 7, 12, 13, 0),
    end: new Date(2024, 7, 12, 13, 45),
  },
  {
    title: "History",
    allDay: false,
    start: new Date(2024, 7, 12, 14, 0),
    end: new Date(2024, 7, 12, 14, 45),
  },
  {
    title: "English",
    allDay: false,
    start: new Date(2024, 7, 13, 9, 0),
    end: new Date(2024, 7, 13, 9, 45),
  },
  {
    title: "Biology",
    allDay: false,
    start: new Date(2024, 7, 13, 10, 0),
    end: new Date(2024, 7, 13, 10, 45),
  },
  {
    title: "Physics",
    allDay: false,
    start: new Date(2024, 7, 13, 11, 0),
    end: new Date(2024, 7, 13, 11, 45),
  },

  {
    title: "History",
    allDay: false,
    start: new Date(2024, 7, 13, 14, 0),
    end: new Date(2024, 7, 13, 14, 45),
  },
  {
    title: "Math",
    allDay: false,
    start: new Date(2024, 7, 14, 8, 0),
    end: new Date(2024, 7, 14, 8, 45),
  },
  {
    title: "Biology",
    allDay: false,
    start: new Date(2024, 7, 14, 10, 0),
    end: new Date(2024, 7, 14, 10, 45),
  },

  {
    title: "Chemistry",
    allDay: false,
    start: new Date(2024, 7, 14, 13, 0),
    end: new Date(2024, 7, 14, 13, 45),
  },
  {
    title: "History",
    allDay: false,
    start: new Date(2024, 7, 14, 14, 0),
    end: new Date(2024, 7, 13, 14, 45),
  },
  {
    title: "English",
    allDay: false,
    start: new Date(2024, 7, 15, 9, 0),
    end: new Date(2024, 7, 15, 9, 45),
  },
  {
    title: "Biology",
    allDay: false,
    start: new Date(2024, 7, 15, 10, 0),
    end: new Date(2024, 7, 15, 10, 45),
  },
  {
    title: "Physics",
    allDay: false,
    start: new Date(2024, 7, 15, 11, 0),
    end: new Date(2024, 7, 15, 11, 45),
  },

  {
    title: "History",
    allDay: false,
    start: new Date(2024, 7, 15, 14, 0),
    end: new Date(2024, 7, 15, 14, 45),
  },
  {
    title: "Math",
    allDay: false,
    start: new Date(2024, 7, 16, 8, 0),
    end: new Date(2024, 7, 16, 8, 45),
  },
  {
    title: "English",
    allDay: false,
    start: new Date(2024, 7, 16, 9, 0),
    end: new Date(2024, 7, 16, 9, 45),
  },

  {
    title: "Physics",
    allDay: false,
    start: new Date(2024, 7, 16, 11, 0),
    end: new Date(2024, 7, 16, 11, 45),
  },
  {
    title: "Chemistry",
    allDay: false,
    start: new Date(2024, 7, 16, 13, 0),
    end: new Date(2024, 7, 16, 13, 45),
  },
  {
    title: "History",
    allDay: false,
    start: new Date(2024, 7, 16, 14, 0),
    end: new Date(2024, 7, 16, 14, 45),
  },
];

export type ExamComponentId =
  | "ca1"
  | "classParticipation"
  | "quiz"
  | "assignment"
  | "ca2"
  | "midtermCarry"
  | "exam";

export type ExamMarkComponent = {
  id: ExamComponentId;
  label: string;
  weight: number;
};

export type ExamMarkDistribution = {
  id: string;
  title: string;
  sessionId: string;
  examType: "midterm" | "final";
  term: "First Term" | "Second Term" | "Third Term";
  schoolId: string | null;
  components: ExamMarkComponent[];
};

export const examMarkDistributions: ExamMarkDistribution[] = [
  {
    id: "2024-2025-final",
    title: "Standard Final Exam",
    sessionId: "2024-2025",
    examType: "final",
    term: "Second Term",
    schoolId: "central",
    components: [
      { id: "midtermCarry", label: "Midterm Aggregate", weight: 20 },
      { id: "ca2", label: "CA2", weight: 20 },
      { id: "exam", label: "Exam", weight: 60 },
    ],
  },
  {
    id: "2024-2025-midterm",
    title: "Standard Midterm Assessment",
    sessionId: "2024-2025",
    examType: "midterm",
    term: "Second Term",
    schoolId: "central",
    components: [
      { id: "ca1", label: "CA1", weight: 20 },
      { id: "quiz", label: "Quiz", weight: 10 },
      { id: "assignment", label: "Assignment", weight: 10 },
      { id: "classParticipation", label: "Class Participation", weight: 10 },
    ],
  },
];
export type ExamScoreComponent = {
  componentId: ExamComponentId;
  score: number;
};

export type ExamScore = {
  id: string;
  studentId: number;
  studentName: string;
  class: string;
  classId: string;
  subject: string;
  examId: number;
  sessionId: string;
  schoolId: string;
  term: "First Term" | "Second Term" | "Third Term";
  examType: "midterm" | "final";
  components: ExamScoreComponent[];
};

export const examScoresData: ExamScore[] = [
  {
    id: "score-1",
    studentId: 101,
    studentName: "Adaobi Johnson",
    class: "SS1A",
    classId: "ss1a",
    subject: "Mathematics",
    examId: 1,
    sessionId: "2024-2025",
    schoolId: "central",
    term: "Second Term",
    examType: "final",
    components: [
      { componentId: "ca1", score: 18 },
      { componentId: "classParticipation", score: 9 },
      { componentId: "quiz", score: 8 },
      { componentId: "assignment", score: 10 },
      { componentId: "ca2", score: 19 },
      { componentId: "exam", score: 56 },
    ],
  },
  {
    id: "score-2",
    studentId: 102,
    studentName: "Ifeanyi Lawson",
    class: "SS1A",
    classId: "ss1a",
    subject: "Mathematics",
    examId: 1,
    sessionId: "2024-2025",
    schoolId: "central",
    term: "Second Term",
    examType: "final",
    components: [
      { componentId: "ca1", score: 15 },
      { componentId: "classParticipation", score: 8 },
      { componentId: "quiz", score: 7 },
      { componentId: "assignment", score: 9 },
      { componentId: "ca2", score: 17 },
      { componentId: "exam", score: 52 },
    ],
  },
  {
    id: "score-3",
    studentId: 103,
    studentName: "Zainab Okonkwo",
    class: "SS2A",
    classId: "ss2a",
    subject: "Physics",
    examId: 3,
    sessionId: "2024-2025",
    schoolId: "downtown",
    term: "Second Term",
    examType: "final",
    components: [
      { componentId: "ca1", score: 19 },
      { componentId: "classParticipation", score: 10 },
      { componentId: "quiz", score: 9 },
      { componentId: "assignment", score: 9 },
      { componentId: "ca2", score: 18 },
      { componentId: "exam", score: 58 },
    ],
  },
];


export type StudentScoreComponent = {
  componentId: ExamComponentId;
  label: string;
  score: number;
  maxScore: number;
};

export type StudentScoreSheet = {
  id: string;
  studentId: number;
  studentName: string;
  classId: string;
  className: string;
  subject: string;
  examType: "midterm" | "final";
  term: "First Term" | "Second Term" | "Third Term";
  sessionId: string;
  components: StudentScoreComponent[];
};

export const studentScoreSheets: StudentScoreSheet[] = [
  {
    id: "sheet-ss1a-math-ada-final",
    studentId: 101,
    studentName: "Adaobi Johnson",
    classId: "ss1a",
    className: "SS1 A",
    subject: "Mathematics",
    examType: "final",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 18, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 9, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 8, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 10, maxScore: 10 },
      { componentId: "ca2", label: "CA2", score: 19, maxScore: 20 },
      { componentId: "exam", label: "Exam", score: 56, maxScore: 60 },
    ],
  },
  {
    id: "sheet-ss1a-english-ada-final",
    studentId: 101,
    studentName: "Adaobi Johnson",
    classId: "ss1a",
    className: "SS1 A",
    subject: "English Language",
    examType: "final",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 17, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 8, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 9, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 10, maxScore: 10 },
      { componentId: "ca2", label: "CA2", score: 18, maxScore: 20 },
      { componentId: "exam", label: "Exam", score: 54, maxScore: 60 },
    ],
  },
  {
    id: "sheet-ss1a-math-ifeanyi-final",
    studentId: 102,
    studentName: "Ifeanyi Lawson",
    classId: "ss1a",
    className: "SS1 A",
    subject: "Mathematics",
    examType: "final",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 16, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 8, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 7, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 9, maxScore: 10 },
      { componentId: "ca2", label: "CA2", score: 18, maxScore: 20 },
      { componentId: "exam", label: "Exam", score: 52, maxScore: 60 },
    ],
  },
  {
    id: "sheet-ss1a-english-ifeanyi-final",
    studentId: 102,
    studentName: "Ifeanyi Lawson",
    classId: "ss1a",
    className: "SS1 A",
    subject: "English Language",
    examType: "final",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 15, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 9, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 8, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 9, maxScore: 10 },
      { componentId: "ca2", label: "CA2", score: 17, maxScore: 20 },
      { componentId: "exam", label: "Exam", score: 50, maxScore: 60 },
    ],
  },
  {
    id: "sheet-ss2c-physics-zainab-final",
    studentId: 103,
    studentName: "Zainab Okonkwo",
    classId: "ss2c",
    className: "SS2 C",
    subject: "Physics",
    examType: "final",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 19, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 10, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 9, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 10, maxScore: 10 },
      { componentId: "ca2", label: "CA2", score: 19, maxScore: 20 },
      { componentId: "exam", label: "Exam", score: 58, maxScore: 60 },
    ],
  },
  {
    id: "sheet-ss2c-chemistry-zainab-final",
    studentId: 103,
    studentName: "Zainab Okonkwo",
    classId: "ss2c",
    className: "SS2 C",
    subject: "Chemistry",
    examType: "final",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 18, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 9, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 9, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 10, maxScore: 10 },
      { componentId: "ca2", label: "CA2", score: 18, maxScore: 20 },
      { componentId: "exam", label: "Exam", score: 57, maxScore: 60 },
    ],
  },
  {
    id: "sheet-ss2c-physics-chiamaka-final",
    studentId: 104,
    studentName: "Chiamaka Umeh",
    classId: "ss2c",
    className: "SS2 C",
    subject: "Physics",
    examType: "final",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 14, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 7, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 6, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 9, maxScore: 10 },
      { componentId: "ca2", label: "CA2", score: 16, maxScore: 20 },
      { componentId: "exam", label: "Exam", score: 45, maxScore: 60 },
    ],
  },
  {
    id: "sheet-ss2c-chemistry-chiamaka-final",
    studentId: 104,
    studentName: "Chiamaka Umeh",
    classId: "ss2c",
    className: "SS2 C",
    subject: "Chemistry",
    examType: "final",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 15, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 7, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 7, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 8, maxScore: 10 },
      { componentId: "ca2", label: "CA2", score: 15, maxScore: 20 },
      { componentId: "exam", label: "Exam", score: 44, maxScore: 60 },
    ],
  },
  {
    id: "sheet-ss1a-math-ada-midterm",
    studentId: 101,
    studentName: "Adaobi Johnson",
    classId: "ss1a",
    className: "SS1 A",
    subject: "Mathematics",
    examType: "midterm",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 18, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 9, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 9, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 9, maxScore: 10 },
    ],
  },
  {
    id: "sheet-ss1a-english-ada-midterm",
    studentId: 101,
    studentName: "Adaobi Johnson",
    classId: "ss1a",
    className: "SS1 A",
    subject: "English Language",
    examType: "midterm",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 17, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 9, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 8, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 9, maxScore: 10 },
    ],
  },
  {
    id: "sheet-ss1a-math-ifeanyi-midterm",
    studentId: 102,
    studentName: "Ifeanyi Lawson",
    classId: "ss1a",
    className: "SS1 A",
    subject: "Mathematics",
    examType: "midterm",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 16, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 8, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 7, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 8, maxScore: 10 },
    ],
  },
  {
    id: "sheet-ss1a-english-ifeanyi-midterm",
    studentId: 102,
    studentName: "Ifeanyi Lawson",
    classId: "ss1a",
    className: "SS1 A",
    subject: "English Language",
    examType: "midterm",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 15, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 8, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 7, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 8, maxScore: 10 },
    ],
  },
  {
    id: "sheet-ss2c-physics-zainab-midterm",
    studentId: 103,
    studentName: "Zainab Okonkwo",
    classId: "ss2c",
    className: "SS2 C",
    subject: "Physics",
    examType: "midterm",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 19, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 10, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 9, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 10, maxScore: 10 },
    ],
  },
  {
    id: "sheet-ss2c-chemistry-zainab-midterm",
    studentId: 103,
    studentName: "Zainab Okonkwo",
    classId: "ss2c",
    className: "SS2 C",
    subject: "Chemistry",
    examType: "midterm",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 18, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 9, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 9, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 9, maxScore: 10 },
    ],
  },
  {
    id: "sheet-ss2c-physics-chiamaka-midterm",
    studentId: 104,
    studentName: "Chiamaka Umeh",
    classId: "ss2c",
    className: "SS2 C",
    subject: "Physics",
    examType: "midterm",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 14, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 7, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 6, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 8, maxScore: 10 },
    ],
  },
  {
    id: "sheet-ss2c-chemistry-chiamaka-midterm",
    studentId: 104,
    studentName: "Chiamaka Umeh",
    classId: "ss2c",
    className: "SS2 C",
    subject: "Chemistry",
    examType: "midterm",
    term: "Second Term",
    sessionId: "2024-2025",
    components: [
      { componentId: "ca1", label: "CA1", score: 15, maxScore: 20 },
      { componentId: "classParticipation", label: "Class Participation", score: 7, maxScore: 10 },
      { componentId: "quiz", label: "Quiz", score: 7, maxScore: 10 },
      { componentId: "assignment", label: "Assignment", score: 7, maxScore: 10 },
    ],
  },
];
export type StudentResultSummary = {
  id: string;
  studentId: number;
  studentName: string;
  classId: string;
  className: string;
  sessionId: string;
  term: "First Term" | "Second Term" | "Third Term";
  subjects: number;
  totalScore: number;
  averageScore: number;
  grade: string;
  remark: string;
  position: number;
};

export const studentFinalResults: StudentResultSummary[] = [
  {
    id: "summary-ss1a-ada",
    studentId: 101,
    studentName: "Adaobi Johnson",
    classId: "ss1a",
    className: "SS1 A",
    sessionId: "2024-2025",
    term: "Second Term",
    subjects: 2,
    totalScore: 181.5,
    averageScore: 90.8,
    grade: "A1",
    remark: "Excellent",
    position: 1,
  },
  {
    id: "summary-ss1a-ifeanyi",
    studentId: 102,
    studentName: "Ifeanyi Lawson",
    classId: "ss1a",
    className: "SS1 A",
    sessionId: "2024-2025",
    term: "Second Term",
    subjects: 2,
    totalScore: 167.7,
    averageScore: 83.9,
    grade: "A1",
    remark: "Excellent",
    position: 2,
  },
  {
    id: "summary-ss2c-zainab",
    studentId: 103,
    studentName: "Zainab Okonkwo",
    classId: "ss2c",
    className: "SS2 C",
    sessionId: "2024-2025",
    term: "Second Term",
    subjects: 2,
    totalScore: 189.8,
    averageScore: 94.9,
    grade: "A1",
    remark: "Excellent",
    position: 1,
  },
  {
    id: "summary-ss2c-chiamaka",
    studentId: 104,
    studentName: "Chiamaka Umeh",
    classId: "ss2c",
    className: "SS2 C",
    sessionId: "2024-2025",
    term: "Second Term",
    subjects: 2,
    totalScore: 140.0,
    averageScore: 70.0,
    grade: "B2",
    remark: "Very Good",
    position: 2,
  },
];

export const studentMidtermResults: StudentResultSummary[] = [
  {
    id: "summary-midterm-ss1a-ada",
    studentId: 101,
    studentName: "Adaobi Johnson",
    classId: "ss1a",
    className: "SS1 A",
    sessionId: "2024-2025",
    term: "Second Term",
    subjects: 2,
    totalScore: 89.0,
    averageScore: 89.0,
    grade: "A1",
    remark: "Excellent",
    position: 1,
  },
  {
    id: "summary-midterm-ss1a-ifeanyi",
    studentId: 102,
    studentName: "Ifeanyi Lawson",
    classId: "ss1a",
    className: "SS1 A",
    sessionId: "2024-2025",
    term: "Second Term",
    subjects: 2,
    totalScore: 78.0,
    averageScore: 78.0,
    grade: "A1",
    remark: "Excellent",
    position: 2,
  },
  {
    id: "summary-midterm-ss2c-zainab",
    studentId: 103,
    studentName: "Zainab Okonkwo",
    classId: "ss2c",
    className: "SS2 C",
    sessionId: "2024-2025",
    term: "Second Term",
    subjects: 2,
    totalScore: 95.0,
    averageScore: 95.0,
    grade: "A1",
    remark: "Excellent",
    position: 1,
  },
  {
    id: "summary-midterm-ss2c-chiamaka",
    studentId: 104,
    studentName: "Chiamaka Umeh",
    classId: "ss2c",
    className: "SS2 C",
    sessionId: "2024-2025",
    term: "Second Term",
    subjects: 2,
    totalScore: 68.0,
    averageScore: 68.0,
    grade: "B3",
    remark: "Good",
    position: 2,
  },
];
export type PromotionPath = {
  classId: string;
  className: string;
  nextClassId: string;
  nextClassName: string;
};

export const promotionPaths: PromotionPath[] = [
  { classId: "ss1a", className: "SS1 A", nextClassId: "ss2a", nextClassName: "SS2 A" },
  { classId: "ss2c", className: "SS2 C", nextClassId: "ss3c", nextClassName: "SS3 C" },
];

export const promotionThreshold = 50;







export type StudentMessage = {
  id: string;
  studentId: number;
  studentName: string;
  sender: string;
  subject: string;
  preview: string;
  date: string;
  category: "announcement" | "reminder" | "alert";
  isRead: boolean;
};

export const studentMessagesData: StudentMessage[] = [
  {
    id: "msg-adaobi-pta",
    studentId: 101,
    studentName: "Adaobi Johnson",
    sender: "Mrs. Balogun",
    subject: "PTA Meeting Reminder",
    preview: "Parents of SS1 A are invited to the PTA meeting this Friday by 4pm...",
    date: "2025-01-10",
    category: "reminder",
    isRead: false,
  },
  {
    id: "msg-ifeanyi-labsafety",
    studentId: 102,
    studentName: "Ifeanyi Lawson",
    sender: "Mr. Peters",
    subject: "Laboratory Safety Brief",
    preview: "Chemistry practical holds tomorrow. Ensure you arrive with your lab coat and goggles...",
    date: "2025-01-08",
    category: "alert",
    isRead: true,
  },
  {
    id: "msg-zainab-competition",
    studentId: 103,
    studentName: "Zainab Okonkwo",
    sender: "STEM Club",
    subject: "National Science Challenge",
    preview: "Congratulations on qualifying for the regional round. Training resumes on Monday...",
    date: "2025-01-05",
    category: "announcement",
    isRead: false,
  },
  {
    id: "msg-chiamaka-support",
    studentId: 104,
    studentName: "Chiamaka Umeh",
    sender: "Counselling Unit",
    subject: "Academic Support Session",
    preview: "We noticed your interest in the physics clinic. Kindly pick a convenient time for tutorials...",
    date: "2025-01-03",
    category: "reminder",
    isRead: true,
  },
];

export type StudentAttendanceRecord = {
  studentId: number;
  studentName: string;
  term: string;
  totalSessions: number;
  present: number;
  late: number;
  absent: number;
};

export const studentAttendanceData: StudentAttendanceRecord[] = [
  {
    studentId: 101,
    studentName: "Adaobi Johnson",
    term: "Second Term",
    totalSessions: 42,
    present: 40,
    late: 1,
    absent: 1,
  },
  {
    studentId: 102,
    studentName: "Ifeanyi Lawson",
    term: "Second Term",
    totalSessions: 42,
    present: 38,
    late: 2,
    absent: 2,
  },
  {
    studentId: 103,
    studentName: "Zainab Okonkwo",
    term: "Second Term",
    totalSessions: 42,
    present: 41,
    late: 1,
    absent: 0,
  },
  {
    studentId: 104,
    studentName: "Chiamaka Umeh",
    term: "Second Term",
    totalSessions: 42,
    present: 36,
    late: 3,
    absent: 3,
  },
];



