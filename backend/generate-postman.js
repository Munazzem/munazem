import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const modulesDir = path.join(__dirname, 'src', 'modules');

const basePaths = {
    'authentication': '/auth',
    'users': '/users',
    'subscriptions': '/subscriptions',
    'groups': '/groups',
    'students': '/students',
    'sessions': '/sessions',
    'attendance': '/attendance',
    'payments': '/payments',
    'notebooks': '/notebooks',
    'reports': '/reports',
    'exams': '/exams'
};

const collection = {
    info: {
        name: "Monazem API",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: []
};

// Regex to match router.get('/path/...', ...), router.post('/path', ...), etc.
const methodRegex = /\b(?:router|authRouter|userRouter|subscriptionsRouter|groupsRouter|studentsRouter|sessionRouter|attendanceRouter|paymentsRouter|notebooksRouter|reportsRouter|examsRouter)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]*)['"`]/g;

function parseRoutes(dirPath, moduleName) {
    const files = fs.readdirSync(dirPath);
    let items = [];

    files.forEach(file => {
        if (file.endsWith('.controller.ts')) {
            const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
            let match;
            while ((match = methodRegex.exec(content)) !== null) {
                const method = match[1].toUpperCase();
                let routePath = match[2];
                if (routePath === '/') routePath = '';

                const fullPath = `{{base_url}}${basePaths[moduleName]}${routePath}`;

                items.push({
                    name: `${method} ${basePaths[moduleName]}${routePath}`,
                    request: {
                        method: method,
                        header: [
                            {
                                key: "Authorization",
                                value: "Bearer {{token}}",
                                type: "text"
                            }
                        ],
                        url: {
                            raw: fullPath,
                            host: [
                                "{{base_url}}"
                            ],
                            path: (basePaths[moduleName] + routePath).split('/').filter(p => p !== '')
                        }
                    }
                });
            }
        }
    });

    return items;
}

const moduleNames = Object.keys(basePaths);
moduleNames.forEach(modName => {
    const modDir = path.join(modulesDir, modName);
    if (fs.existsSync(modDir)) {
        const routes = parseRoutes(modDir, modName);
        if (routes.length > 0) {
            collection.item.push({
                name: modName.charAt(0).toUpperCase() + modName.slice(1),
                item: routes
            });
        }
    }
});

collection.variable = [
    {
        key: "base_url",
        value: "http://localhost:5000",
        type: "string"
    },
    {
        key: "token",
        value: "",
        type: "string"
    }
];

fs.writeFileSync(path.join(__dirname, 'monazem_postman_collection.json'), JSON.stringify(collection, null, 4));
console.log("Postman collection generated successfully!");
