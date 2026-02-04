interface QuestionCardProps {
  question: string;
  options: string[];
  correctOption: string;
  selectedAnswer: string | null;
  currentQuestionNumber: number;
  totalQuestions: number;
  onAnswerSelect: (option: string) => void;
  disabled?: boolean;
}

export const QuestionCard = ({
  question,
  options,
  correctOption,
  selectedAnswer,
  currentQuestionNumber,
  totalQuestions,
  onAnswerSelect,
  disabled = false,
}: QuestionCardProps) => {
  // Ensure options and correctOption are strings (API/Excel may return numbers)
  const safeOptions = (options || []).map((o) => (o != null ? String(o) : ''));
  const safeCorrectOption = correctOption != null ? String(correctOption) : '';

  return (
    <div className="w-full">
      {/* Top Banner */}
      <div className="flex items-center justify-center whitespace-nowrap 
                gap-x-2 text-md sm:text-base md:text-xl px-2 py-2">
        <p className="font-normal text-white">
          Answer Two Questions & Win Upto
        </p>

        <p className="font-semibold text-[#FFD602]">
          200
        </p>

        <img src="/intro-coin.svg" alt="Coins" className="w-5 h-5" />
    </div>



      {/* Question Card */}
      <div className="bg-[#FFF6D9] rounded-xl p-3 pb-12 shadow-lg relative border-[#BFBAA7] border-3">
        {/* Question */}
        <div className="rounded-xl py-1 px-1 mb-4">
          <h2 className="text-lg font-semibold text-black text-center leading-relaxed">
            {question}
          </h2>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3">
          {safeOptions.map((option, index) => {
            const isSelected = selectedAnswer === option;
            const isCorrect = option === safeCorrectOption;
            const showCorrectAnswer = selectedAnswer !== null; // Show correct answer after selection

            let buttonClass =
              'py-1 px-4 rounded-xl font-semibold text-center shadow-md transition overflow-hidden break-words whitespace-normal min-h-[3rem] flex items-center justify-center';

            // If an answer has been selected, show feedback
            if (showCorrectAnswer) {
              if (isCorrect) {
                // Correct answer - always show in green
                buttonClass += ' bg-[#34A853] text-white border-[#34A853]';
              } else if (isSelected) {
                // Wrong selected answer - show in red
                buttonClass += ' bg-[#ED4762] text-white border-[#ED4762]';
              } else {
                // Not selected and not correct - show as normal but slightly dimmed
                buttonClass += ' bg-white text-black border-gray-300 opacity-60';
              }
            } else {
              // No answer selected yet - normal state
              buttonClass +=
                ' bg-white text-black  hover:border-gray-500';
            }

            if (disabled || selectedAnswer) {
              buttonClass += ' cursor-not-allowed opacity-95';
            } else {
              buttonClass += ' cursor-pointer active:scale-95';
            }

            return (
              <button
                key={index}
                className={buttonClass}
                onClick={() =>
                  !disabled && !selectedAnswer && onAnswerSelect(option)
                }
                disabled={disabled || !!selectedAnswer}
              >
                <span className="block w-full break-words">{option}</span>
              </button>
            );
          })}
        </div>

        {/* Progress Indicator (HALF INSIDE / HALF OUTSIDE) */}
        <div className="absolute left-1/2 -bottom-4 -translate-x-1/2">
          <div className="bg-[#FFF6D9] border-2 border-[#BFBAA7] rounded-xl px-4 py-1.5 shadow-md w-fit">
            <span className="text-sm font-medium text-black">
              {currentQuestionNumber} Of <span className="font-extrabold">
                                            {totalQuestions}
                                          </span> Questions
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};









