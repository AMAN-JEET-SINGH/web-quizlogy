'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { feedbackApi } from '@/lib/api';

export default function ContactUsPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields are filled
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }
    if (!formData.email.trim()) {
      alert('Email is required');
      return;
    }
    if (!formData.message.trim()) {
      alert('Message is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await feedbackApi.sendContact({
        name: formData.name.trim(),
        email: formData.email.trim(),
        message: formData.message.trim(),
      });
      
      // Show success message
      alert(response.message || 'Thank you for your message! We will get back to you soon.');
      
      // Reset form
      setFormData({ name: '', email: '', message: '' });
    } catch (err: any) {
      console.error('Error sending feedback:', err);
      const errorMessage = err.response?.data?.error || 'Failed to send message. Please try again.';
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead 
        title="Contact Quizwala - Get in Touch With Us"
        description="Have questions or feedback? Contact Quizwala support team. We're here to help with any queries about quizzes, contests, coins, or account issues."
        keywords="contact quizwala, quiz support, quiz help, quiz feedback, quiz customer service"
      />
      <DashboardNav />
      <div className="min-h-screen bg-[#0D0009] p-5" style={{
        boxShadow: '0px 0px 2px 0px #FFF6D9'
      }}>
        <div className="max-w-4xl mx-auto">
          {/* Back Button - Outside the div */}
          <button
            onClick={() => router.back()}
            className="text-[#FFF6D9] hover:text-gray-300 transition-colors mb-4 flex items-center gap-2"
          >
            <span className="text-lg font-medium">Back</span>
          </button>
          
          <div className="bg-[#FFF6D9] rounded-xl p-6 mb-5 border border-[#BFBAA7]" style={{
            boxShadow: '0px 0px 2px 0px #FFF6D9'
          }}>
            <h1 className="text-[#0D0009] text-3xl font-bold mb-6">Contact Us</h1>
            
            <div className="space-y-6">
              <div className="text-[#0D0009]">
                <p className="text-[#0D0009]/90 mb-4">
                  Have a question or feedback? We'd love to hear from you! 
                  Fill out the form below and we'll get back to you as soon as possible.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[#0D0009]/70 text-sm mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full bg-white text-[#0D0009] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7]"
                  />
                </div>

                <div>
                  <label className="block text-[#0D0009]/70 text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full bg-white text-[#0D0009] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7]"
                  />
                </div>

                <div>
                  <label className="block text-[#0D0009]/70 text-sm mb-2">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    rows={6}
                    className="w-full bg-white text-[#0D0009] px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none border border-[#BFBAA7]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-yellow-400 text-[#0D0009] font-bold py-3 px-6 rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                >
                  <span className="relative z-10">{submitting ? 'Sending...' : 'Send Message'}</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
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
