'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// import { useEffect, useState } from 'react';
// import { questionsApi, Question } from '@/lib/api';
// import { HeadNav } from "../components/headnav";
// import AdsenseAd from '@/components/AdsenseAd';
// import { Footer } from '@/components/Footer';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/splash');
  }, [router]);

  return null;
  
  // return (
  //   <div>
  //     <HeadNav/>
  //     <div className="bg-[#2C2159] rounded-lg p-2 mb-5 shadow-lg">
  //       <p className="text-center text-[#7563C0] text-sm ">Advertisement</p>
  //       <AdsenseAd/>
  //      </div>
  //     <Footer />
  //   </div>
  // );
}
