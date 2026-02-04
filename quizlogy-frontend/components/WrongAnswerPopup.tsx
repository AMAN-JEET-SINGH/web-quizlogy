interface WrongAnswerPopupProps {
  correctCount: number;
  onWatchAd: () => void;
  onClose: () => void;
}

export const WrongAnswerPopup = ({ correctCount, onWatchAd, onClose }: WrongAnswerPopupProps) => {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-5 z-50">
      <div className="bg-[#2C2159] rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-white hover:text-gray-300 text-3xl font-light leading-none transition-colors"
        >
          ×
        </button>

        {/* Icon with Speech Bubble */}
        <div className="flex justify-center mb-6">
          <div className="relative">

              <div className="w-20 h-20 rounded-full bg-purple-200/50 flex items-center justify-center relative">
                {/* Speech bubble */}
                
                  <img src="/oops.svg" alt="oops image" />
                
              </div>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-white text-center mb-1">
          OOPS!
        </h2>
        <h2 className="text-3xl font-bold text-white text-center mb-4">
          Wrong Answer
        </h2>

        {/* Message */}
        <p className="text-white text-center text-base mb-8 leading-relaxed px-2">
          {correctCount === 0
            ? "You're One Step Away From 200 Coins Just Watch a AD"
            : "You're One Step Away From 200 Coins Just Watch a AD (Instead of 100 coins)"}
        </p>

        {/* Claim Button */}
        <button
          onClick={onWatchAd}
          className="w-full bg-[#FBD457] hover:bg-yellow-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden"
        >
          {/* Video/Film icon */}
          <img src="/multimedia.svg" alt="video icon" className="w-6 h-6 relative z-10" />
          <span className="text-lg text-[#392C6E] relative z-10">Claim</span>
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
        </button>
      </div>
    </div>
  );
};











