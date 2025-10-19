const fs = require('fs');
const path = 'next-dashboard-ui-completed/src/app/(dashboard)/results/self/page.tsx';
let src = fs.readFileSync(path, 'utf8');
const marker = "      <section className=\"grid gap-4 lg:grid-cols-3\">";
