SELECT 'School' AS table, COUNT(*) AS count FROM "School"
UNION ALL
SELECT 'Teacher', COUNT(*) FROM "Teacher"
UNION ALL
SELECT 'Student', COUNT(*) FROM "Student";
