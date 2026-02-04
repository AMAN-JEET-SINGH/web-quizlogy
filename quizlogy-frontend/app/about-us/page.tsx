'use client';

import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';

export default function AboutUsPage() {
  const router = useRouter();
  
  return (
    <>
      <SEOHead 
        title="About Quizwala - Learn More About Our Quiz Platform"
        description="Learn about Quizwala - India's leading quiz platform. Discover our mission to make learning fun and rewarding through engaging quizzes, contests, and coin rewards."
        keywords="about quizwala, quiz platform, quiz app, online quiz, quiz company, quiz mission"
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
            <h1 className="text-[#0D0009] text-3xl font-bold mb-6">About Us</h1>
            
            <div className="space-y-6 text-[#0D0009]">
              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">Welcome to Quizwala</h2>
                <p className="text-[#0D0009]/90 leading-relaxed">
                  Quizwala is a fun and engaging quiz platform where you can test your knowledge, 
                  compete with others, and earn rewards. We offer a wide range of quiz topics 
                  to challenge your mind and help you learn new things every day.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">Our Mission</h2>
                <p className="text-[#0D0009]/90 leading-relaxed">
                  Our mission is to make learning fun and rewarding. We believe that quizzes 
                  are a great way to expand knowledge, improve cognitive skills, and have 
                  fun at the same time. Join thousands of players from around the world 
                  and start your quiz journey today!
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-yellow-400">Features</h2>
                <ul className="space-y-2 list-disc list-inside text-[#0D0009]/90">
                  <li>Wide variety of quiz categories</li>
                  <li>Compete with players worldwide</li>
                  <li>Earn coins and rewards</li>
                  <li>Track your progress and achievements</li>
                  <li>Regular contests and challenges</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

