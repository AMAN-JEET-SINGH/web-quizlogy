'use client';

import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';

export default function PrivacyPolicyPage() {
  const router = useRouter();
  
  return (
    <>
      <SEOHead 
        title="Privacy Policy - Quizwala Data Protection & Privacy"
        description="Read Quizwala's privacy policy to understand how we collect, use, and protect your personal information. Learn about your data rights and our commitment to privacy."
        keywords="privacy policy, data protection, quiz privacy, user privacy, quiz data security"
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
            <h1 className="text-[#0D0009] text-3xl font-bold mb-6">Privacy Policy</h1>
            
            <div className="space-y-6 text-[#0D0009]">
              <div>
                <p className="text-[#0D0009]/70 text-sm mb-4">
                  Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-[#0D0009]/90 leading-relaxed mb-4">
                  At Quizwala, operated by Quizango Media Pvt. Ltd. ("QMPL", "we", "us", or "our"), we are 
                  committed to protecting your privacy. This Privacy Policy explains how we collect, use, 
                  disclose, and safeguard your information when you use our quiz platform.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">1. Information We Collect</h2>
                
                <h3 className="text-lg font-semibold mb-2 text-yellow-300 mt-4">1.1 Information You Provide</h3>
                <ul className="space-y-2 list-disc list-inside text-[#0D0009]/90 ml-4">
                  <li><strong>Account Information:</strong> Name, email address, profile picture (when using Google OAuth)</li>
                  <li><strong>Contest Participation:</strong> Answers, scores, rankings, and contest history</li>
                  <li><strong>Feedback and Support:</strong> Information you provide when contacting us</li>
                </ul>

                <h3 className="text-lg font-semibold mb-2 text-yellow-300 mt-4">1.2 Automatically Collected Information</h3>
                <ul className="space-y-2 list-disc list-inside text-[#0D0009]/90 ml-4">
                  <li><strong>Usage Data:</strong> How you interact with our platform, pages visited, time spent</li>
                  <li><strong>Device Information:</strong> IP address, browser type, device type, operating system</li>
                  <li><strong>Cookies and Tracking:</strong> We use cookies to enhance your experience and analyze usage</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">2. How We Use Your Information</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">We use the collected information for the following purposes:</p>
                <ul className="space-y-2 list-disc list-inside text-[#0D0009]/90 ml-4">
                  <li>To provide and maintain our quiz platform services</li>
                  <li>To process contest entries and calculate scores and rankings</li>
                  <li>To manage your account and authenticate your identity</li>
                  <li>To track coin transactions and reward distributions</li>
                  <li>To improve our services and develop new features</li>
                  <li>To send you important updates and notifications</li>
                  <li>To respond to your inquiries and provide customer support</li>
                  <li>To detect and prevent fraud, abuse, and security issues</li>
                  <li>To comply with legal obligations</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">3. Information Sharing and Disclosure</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">We do not sell your personal information. We may share your information in the following circumstances:</p>
                
                <h3 className="text-lg font-semibold mb-2 text-yellow-300 mt-4">3.1 Service Providers</h3>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  We may share information with third-party service providers who perform services on our behalf, 
                  such as hosting, analytics, and payment processing. These providers are contractually obligated 
                  to protect your information.
                </p>

                <h3 className="text-lg font-semibold mb-2 text-yellow-300 mt-4">3.2 Legal Requirements</h3>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  We may disclose your information if required by law, court order, or government regulation, 
                  or to protect our rights, property, or safety, or that of our users.
                </p>

                <h3 className="text-lg font-semibold mb-2 text-yellow-300 mt-4">3.3 Business Transfers</h3>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  In the event of a merger, acquisition, or sale of assets, your information may be transferred 
                  to the acquiring entity.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">4. Data Security</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  We implement appropriate technical and organizational security measures to protect your personal 
                  information against unauthorized access, alteration, disclosure, or destruction. However, no 
                  method of transmission over the internet or electronic storage is 100% secure.
                </p>
                <p className="text-[#0D0009]/90 leading-relaxed">
                  We use encryption, secure servers, and access controls to safeguard your data. Despite our 
                  efforts, we cannot guarantee absolute security.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">5. Cookies and Tracking Technologies</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">We use cookies and similar tracking technologies to:</p>
                <ul className="space-y-2 list-disc list-inside text-[#0D0009]/90 ml-4">
                  <li>Remember your preferences and settings</li>
                  <li>Authenticate your session</li>
                  <li>Analyze how you use our platform</li>
                  <li>Improve our services and user experience</li>
                </ul>
                <p className="text-[#0D0009]/90 leading-relaxed mt-2">
                  You can control cookies through your browser settings. However, disabling cookies may affect 
                  the functionality of our platform.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">6. Third-Party Services</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  Our platform may contain links to third-party websites or integrate with third-party services 
                  (such as Google OAuth). We are not responsible for the privacy practices of these third parties. 
                  We encourage you to review their privacy policies.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">7. Data Retention</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  We retain your personal information for as long as necessary to fulfill the purposes outlined 
                  in this Privacy Policy, unless a longer retention period is required or permitted by law. 
                  When you delete your account, we will delete or anonymize your personal information, except 
                  where we are required to retain it for legal purposes.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">8. Your Rights and Choices</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">You have the following rights regarding your personal information:</p>
                <ul className="space-y-2 list-disc list-inside text-[#0D0009]/90 ml-4">
                  <li><strong>Access:</strong> Request access to your personal information</li>
                  <li><strong>Correction:</strong> Request correction of inaccurate information</li>
                  <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                  <li><strong>Objection:</strong> Object to processing of your personal information</li>
                  <li><strong>Data Portability:</strong> Request a copy of your data in a portable format</li>
                  <li><strong>Withdraw Consent:</strong> Withdraw consent for data processing where applicable</li>
                </ul>
                <p className="text-[#0D0009]/90 leading-relaxed mt-2">
                  To exercise these rights, please contact us using the information provided in Section 12.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">9. Children's Privacy</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  Quizwala is not intended for children under 13 years of age. We do not knowingly collect 
                  personal information from children under 13. If you believe we have collected information 
                  from a child under 13, please contact us immediately, and we will take steps to delete 
                  such information.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">10. International Data Transfers</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  Your information may be transferred to and processed in countries other than your country 
                  of residence. These countries may have data protection laws that differ from those in your 
                  country. By using Quizwala, you consent to the transfer of your information to these countries.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">11. Changes to This Privacy Policy</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  We may update this Privacy Policy from time to time. We will notify you of any material 
                  changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. 
                  We encourage you to review this Privacy Policy periodically.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">12. Contact Us</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  If you have any questions, concerns, or requests regarding this Privacy Policy or our data 
                  practices, please contact us at:
                </p>
                <p className="text-[#0D0009]/90 leading-relaxed">
                  <strong>Quizango Media Pvt. Ltd.</strong><br />
                  Email: privacy@quizwala.com<br />
                  Support Email: support@quizwala.com<br />
                  Website: https://quizangomedia.com
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">13. Consent</h2>
                <p className="text-[#0D0009]/90 leading-relaxed mb-2">
                  By using Quizwala, you consent to the collection, use, and disclosure of your information 
                  as described in this Privacy Policy.
                </p>
              </div>

              <div className="mt-8 p-4 bg-[#0D0009] rounded-lg border border-[#BFBAA7]">
                <p className="text-[#FFF6D9]/80 text-sm">
                  This Privacy Policy is effective as of the "Last Updated" date and applies to all information 
                  collected by Quizwala. Your continued use of our platform after changes to this Privacy Policy 
                  constitutes acceptance of those changes.
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

