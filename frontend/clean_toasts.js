const fs = require('fs');
const path = require('path');

function walkProcess(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkProcess(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let originalContent = content;
      
      // Match 1: inline onError arrow functions
      // e.g. onError: (err: any) => toast.error(err?.response?.data?.message ?? 'حدث خطأ'),
      content = content.replace(/onError:\s*\([^)]*\)\s*=>\s*toast\.error\([^)]+\),?/g, '');
      
      // Match 2: statements ending with semicolon
      // e.g. toast.error(err?.response?.data?.message ?? 'حدث خطأ');
      content = content.replace(/toast\.error\([^;]+(?:response\?\.data\?\.message|error\?\.response)[^;]+\);?/g, '');

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content);
        console.log(`Cleaned: ${fullPath}`);
      }
    }
  }
}

walkProcess('d:/Projects/SAAS/monazem/frontend/src/components');
walkProcess('d:/Projects/SAAS/monazem/frontend/src/app');
