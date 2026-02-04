'use client';

import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';

export default function TermsAndConditionsPage() {
  const router = useRouter();
  
  return (
    <>
      <SEOHead 
        title="Terms and Conditions - Quizwala Terms of Service"
        description="Read Quizwala's terms and conditions. Understand the rules, guidelines, and terms of service for using our quiz platform, contests, and coin system."
        keywords="terms and conditions, terms of service, quiz terms, user agreement, quiz rules"
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
              onClick={() => router.back()}
              className="absolute top-4 left-4 text-[#0D0009] hover:text-gray-600 transition-colors z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-[#0D0009] text-3xl font-bold mb-6 ml-8">Terms and Conditions</h1>
            
            <div className="space-y-6 text-[#0D0009]">
              <div>
                <p className="text-[#0D0009]/70 text-sm mb-4">
                  Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-[#0D0009]/90 leading-relaxed mb-4">
                  Welcome to Quizwala! These Terms and Conditions ("Terms") govern your use of the Quizwala 
                  platform operated by Quizango Media Pvt. Ltd. ("QMPL", "we", "us", or "our"). By accessing 
                  or using our services, you agree to be bound by these Terms.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">1. Acceptance of Terms</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  By accessing and using Quizwala, you accept and agree to be bound by these Terms and Conditions. 
                  If you do not agree to these Terms, please do not use our services.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">2. Eligibility</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  You must be at least 13 years old to use Quizwala. By using our services, you represent and 
                  warrant that you meet the age requirement and have the legal capacity to enter into these Terms.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">3. User Accounts</h2>
                <ul className="space-y-2 list-disc list-inside text-[#0D0009]/90 ml-4">
                  <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                  <li>You agree to provide accurate and complete information when creating an account</li>
                  <li>You are responsible for all activities that occur under your account</li>
                  <li>You must notify us immediately of any unauthorized use of your account</li>
                  <li>We reserve the right to suspend or terminate accounts that violate these Terms</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">4. Use of Service</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">You agree to use Quizwala only for lawful purposes and in accordance with these Terms. You agree NOT to:</p>
                <ul className="space-y-2 list-disc list-inside text-[#0D0009]/90 ml-4">
                  <li>Use the service for any illegal or unauthorized purpose</li>
                  <li>Attempt to gain unauthorized access to any part of the service</li>
                  <li>Interfere with or disrupt the service or servers</li>
                  <li>Use automated systems, bots, or scripts to access the service</li>
                  <li>Share your account with others or allow others to use your account</li>
                  <li>Engage in any form of cheating, fraud, or manipulation</li>
                  <li>Harass, abuse, or harm other users</li>
                  <li>Violate any applicable laws or regulations</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">5. Coins and Rewards</h2>
                <ul className="space-y-2 list-disc list-inside text-[#0D0009]/90 ml-4">
                  <li>Coins earned on Quizwala are virtual currency and have no real-world monetary value</li>
                  <li>Coins cannot be exchanged for cash or real money</li>
                  <li>We reserve the right to modify, suspend, or discontinue the coin system at any time</li>
                  <li>Coins may be deducted for violations of these Terms</li>
                  <li>All coin transactions are final and non-refundable</li>
                  <li>We are not responsible for any loss of coins due to technical issues or user error</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">6. Contests and Competitions</h2>
                <ul className="space-y-2 list-disc list-inside text-[#0D0009]/90 ml-4">
                  <li>Contest entry fees are non-refundable once paid</li>
                  <li>Contest results are final and binding</li>
                  <li>We reserve the right to disqualify participants who violate rules or Terms</li>
                  <li>Prize distribution is subject to verification of eligibility and compliance</li>
                  <li>We reserve the right to cancel or modify contests at any time</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">7. Intellectual Property</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  All content on Quizwala, including but not limited to text, graphics, logos, images, questions, 
                  and software, is the property of QMPL or its content suppliers and is protected by copyright, 
                  trademark, and other intellectual property laws.
                </p>
                <p className="text-[#0D0009]/90 leading-relaxed">
                  You may not reproduce, distribute, modify, or create derivative works from any content on 
                  Quizwala without our express written permission.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">8. User Content</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  By submitting content to Quizwala (such as feedback, reports, or suggestions), you grant us 
                  a non-exclusive, royalty-free, perpetual, and worldwide license to use, modify, and display 
                  such content.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">9. Disclaimers</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  Quizwala is provided "as is" and "as available" without warranties of any kind, either express 
                  or implied. We do not guarantee that the service will be uninterrupted, error-free, or free 
                  from viruses or other harmful components.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">10. Limitation of Liability</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  To the maximum extent permitted by law, QMPL shall not be liable for any indirect, incidental, 
                  special, consequential, or punitive damages, or any loss of profits or revenues, whether 
                  incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">11. Indemnification</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  You agree to indemnify and hold harmless QMPL, its officers, directors, employees, and agents 
                  from any claims, damages, losses, liabilities, and expenses (including legal fees) arising 
                  out of your use of the service or violation of these Terms.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">12. Termination</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  We reserve the right to suspend or terminate your access to Quizwala at any time, with or 
                  without cause or notice, for any reason, including violation of these Terms.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">13. Changes to Terms</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  We reserve the right to modify these Terms at any time. We will notify users of significant 
                  changes by posting the updated Terms on this page. Your continued use of Quizwala after 
                  changes become effective constitutes acceptance of the modified Terms.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">14. Governing Law</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  These Terms shall be governed by and construed in accordance with the laws of India, without 
                  regard to its conflict of law provisions. Any disputes arising from these Terms shall be 
                  subject to the exclusive jurisdiction of the courts in India.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">15. Contact Information</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  If you have any questions about these Terms and Conditions, please contact us at:
                </p>
                <p className="text-[#0D0009]/90 leading-relaxed">
                  <strong>Quizango Media Pvt. Ltd.</strong><br />
                  Email: support@quizwala.com<br />
                  Website: https://quizangomedia.com
                </p>
              </div>

              <div className="mt-8 p-4 bg-[#0D0009] rounded-lg border border-[#BFBAA7]">
                <p className="text-[#FFF6D9]/80 text-sm">
                  By using Quizwala, you acknowledge that you have read, understood, and agree to be bound by 
                  these Terms and Conditions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

