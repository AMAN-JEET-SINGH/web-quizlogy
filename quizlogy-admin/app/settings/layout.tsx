'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/lib/adminContext';
import ReportsNavbar from '@/components/ReportsNavbar';
import '../reports/reports.css';

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAdmin, loading } = useAdmin();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !isAdmin) {
            router.push('/auth/login');
        }
    }, [isAdmin, loading, router]);

    if (loading) {
        return (
            <div className="reports-loading">
                <p>Loading...</p>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="reports-loading">
                <p>Redirecting to login...</p>
            </div>
        );
    }

    return (
        <ReportsNavbar>
            {children}
        </ReportsNavbar>
    );
}
