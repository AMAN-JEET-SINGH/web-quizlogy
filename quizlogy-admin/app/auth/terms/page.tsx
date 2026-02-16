'use client';

import { useRouter } from 'next/navigation';
import './terms.css';

export default function TermsAndConditions() {
  const router = useRouter();

  return (
    <div className="terms-page">
      <div className="terms-top-bar" />

      <div className="terms-container">
        <button className="terms-back-btn" onClick={() => router.push('/auth/login')}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Login
        </button>

        <div className="terms-card">
          <h1>Terms &amp; Conditions</h1>
          <p className="terms-updated">Last updated: February 9, 2026</p>

          <div className="terms-body">
            <section>
              <h2>1. Acceptance of Terms</h2>
              <p>
                By accessing or using the Quizlogy Admin Panel (&ldquo;the Platform&rdquo;), you agree to be bound by these
                Terms &amp; Conditions. If you do not agree with any part of these terms, you must not use the
                Platform. Your continued use of the Platform constitutes acceptance of these terms and any
                future amendments.
              </p>
            </section>

            <section>
              <h2>2. Account Responsibilities</h2>
              <p>
                As an administrator, you are responsible for maintaining the confidentiality of your login
                credentials. You agree not to share your username or password with any unauthorized individual.
                Any activity that occurs under your account is your sole responsibility. You must notify the
                super administrator immediately if you suspect any unauthorized access to your account.
              </p>
            </section>

            <section>
              <h2>3. Permitted Use</h2>
              <p>
                The Platform is provided exclusively for managing quizzes, contests, battles, categories,
                user accounts, advertisements, and related content for the Quizlogy application. You agree
                to use the Platform only for its intended purpose and in compliance with all applicable laws
                and regulations. Any misuse of the Platform, including but not limited to unauthorized data
                extraction, manipulation of contest results, or abuse of administrative privileges, is
                strictly prohibited.
              </p>
            </section>

            <section>
              <h2>4. Content Management</h2>
              <p>
                You are responsible for the accuracy, quality, and legality of all content you create,
                edit, or publish through the Platform. This includes quiz questions, contest details,
                category information, images, and any other material. Content must not contain hate speech,
                misinformation, copyrighted material without authorization, or any material that violates
                local or international laws. The Platform reserves the right to remove any content deemed
                inappropriate without prior notice.
              </p>
            </section>

            <section>
              <h2>5. Data Privacy &amp; Confidentiality</h2>
              <p>
                You acknowledge that you may have access to sensitive user data, including personal
                information, quiz performance, and financial records (such as AdSense earnings and
                invoice details). You agree to handle all such data with the utmost care and in
                compliance with applicable data protection regulations. Unauthorized disclosure,
                copying, or misuse of user data is a serious violation of these terms and may result
                in immediate termination of your access along with legal action.
              </p>
            </section>

            <section>
              <h2>6. Financial &amp; Revenue Information</h2>
              <p>
                Any financial data, revenue reports, AdSense earnings, invoice records, and payment
                information accessible through the Platform are confidential. You must not disclose
                financial details to third parties without explicit written consent from the Platform
                owner. Revenue share percentages and earnings are subject to the terms agreed upon
                during your onboarding and may be revised with prior written notice.
              </p>
            </section>

            <section>
              <h2>7. Intellectual Property</h2>
              <p>
                All software, design, code, trademarks, logos, and proprietary content within the
                Platform are the exclusive property of Quizlogy and its licensors. You are granted a
                limited, non-exclusive, non-transferable license to use the Platform for its intended
                administrative purposes. You may not copy, modify, distribute, or reverse-engineer
                any part of the Platform.
              </p>
            </section>

            <section>
              <h2>8. Service Availability</h2>
              <p>
                While we strive to maintain uninterrupted access to the Platform, we do not guarantee
                100% uptime. The Platform may be temporarily unavailable due to maintenance, updates,
                or circumstances beyond our control. We shall not be liable for any loss or damage
                arising from service interruptions.
              </p>
            </section>

            <section>
              <h2>9. Termination</h2>
              <p>
                Your access to the Platform may be suspended or terminated at any time by the super
                administrator, with or without cause. Upon termination, you must immediately cease all
                use of the Platform. Any data or content you created through the Platform remains the
                property of Quizlogy. Violations of these terms may result in immediate termination
                without prior notice.
              </p>
            </section>

            <section>
              <h2>10. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Quizlogy and its affiliates shall not be liable
                for any indirect, incidental, special, consequential, or punitive damages arising from
                your use of the Platform. This includes, but is not limited to, loss of profits, data,
                or business opportunities. Our total liability shall not exceed the amount paid to you
                (if any) in the twelve months preceding the claim.
              </p>
            </section>

            <section>
              <h2>11. Modifications to Terms</h2>
              <p>
                We reserve the right to update or modify these Terms &amp; Conditions at any time.
                Changes will be communicated through the Platform or via email. Your continued use of
                the Platform after changes are posted constitutes your acceptance of the revised terms.
                It is your responsibility to review these terms periodically.
              </p>
            </section>

            <section>
              <h2>12. Governing Law</h2>
              <p>
                These Terms &amp; Conditions shall be governed by and construed in accordance with the
                laws of India. Any disputes arising from these terms or your use of the Platform shall
                be resolved through arbitration in Rajasthan, India, in accordance with the Arbitration
                and Conciliation Act, 1996.
              </p>
            </section>

            <section>
              <h2>13. Contact</h2>
              <p>
                If you have any questions or concerns about these Terms &amp; Conditions, please
                contact the super administrator through the Platform&apos;s contact messaging system
                or reach out via the official support channels.
              </p>
            </section>
          </div>

          <div className="terms-footer">
            <p>By checking &ldquo;Accept Terms &amp; Conditions&rdquo; on the login page, you confirm that you have read, understood, and agree to be bound by these terms.</p>
            <button className="terms-back-login-btn" onClick={() => router.push('/auth/login')}>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
