
export const Footer = () => {
  return (
    <div className="bg-[#0D0009]  text-center text-white py-2 px-3 border-t-1 border-[#564C53]">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl border-2 border-white shadow-lg">
            <img src="/logo.svg" alt="logo" className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold">Quizwala</h2>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-4 justify-center w-fit mx-auto mb-8">
          <a href="/terms-and-conditions" className="text-white underline hover:opacity-80 transition-opacity text-sm">
            Terms & Conditions
          </a>
          <a href="/privacy-policy" className="text-white underline hover:opacity-80 transition-opacity text-sm">
            Privacy policy
          </a>
          <a href="/about-us" className="text-white underline hover:opacity-80 transition-opacity text-sm">
            About Us
          </a>
          <a href="https://quizangomedia.com" className="text-white underline hover:opacity-80 transition-opacity text-sm ">
            Partner With Us
          </a>
        </div>
        <div className="text-white/70 text-xs leading-relaxed">
          © 2025 Quizango media Pvt. Ltd. ("QMPL"). Quizwala® are registered trademarks of QMPL.
        </div>
      </div>
  );
};
