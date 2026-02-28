import { redirect } from 'next/navigation';

export default function Home() {
    // We just redirect the root URL to the dashboard.
    // Middleware will catch this and kick unauthenticated users to /login anyway.
    redirect('/dashboard');
}
