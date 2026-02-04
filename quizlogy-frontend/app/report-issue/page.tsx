'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';

export default function ReportIssuePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    type: 'bug',
    description: '',
    email: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission here
    alert('Thank you for reporting the issue! We will investigate and get back to you soon.');
    setFormData({ type: 'bug', description: '', email: '' });
  };

  return (
    <>
      <SEOHead 
        title="Report an Issue - Quizwala Support & Feedback"
        description="Report bugs, issues, or provide feedback to Quizwala. Help us improve the platform by reporting any problems you encounter while playing quizzes."
        keywords="report issue, quiz bug report, quiz feedback, quiz support, report problem"
      />
      <DashboardNav />
      <div className="min-h-screen bg-[#0D0009] p-5" style={{
        boxShadow: '0px 0px 2px 0px #FFF6D9'
      }}>
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#FFF6D9] rounded-xl p-6 mb-5 border border-[#BFBAA7] relative" style={{
            boxShadow: '0px 0px 2px 0px #FFF6D9'
          }}>
            {/* Back Button */}
            <button
              onClick={() => router.push('/dashboard')}
              className="absolute top-4 left-4 text-[#0D0009] hover:text-gray-600 transition-colors z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-[#0D0009] text-3xl font-bold mb-6 ml-8">Report An Issue</h1>
            
            <div className="space-y-6">
              <div className="text-[#0D0009]">
                <p className="text-[#0D0009]/90 mb-4">
                  Found a bug or have a concern? Please let us know! 
                  Your feedback helps us improve the platform for everyone.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[#0D0009]/70 text-sm mb-2">Issue Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-white text-[#0D0009] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7]"
                  >
                    <option value="bug">Bug Report</option>
                    <option value="feature">Feature Request</option>
                    <option value="content">Content Error</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#0D0009]/70 text-sm mb-2">Email (Optional)</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white text-[#0D0009] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7]"
                  />
                </div>

                <div>
                  <label className="block text-[#0D0009]/70 text-sm mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    rows={8}
                    placeholder="Please describe the issue in detail..."
                    className="w-full bg-white text-[#0D0009] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none placeholder-[#0D0009]/30 border border-[#BFBAA7]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-red-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-600 transition-colors"
                >
                  Submit Report
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

