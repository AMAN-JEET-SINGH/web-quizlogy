export const HeadNav = () => {
  return (
    <div className="flex justify-center items-center pt-2 pb-2 flex-row gap-2 boxstyle navbox">
      <button onClick={() => {
        window.location.href = '/';
      }}>
        <img src="/logo.svg" alt="logo" />
      </button><button onClick={() => {
        window.location.href = '/dashboard';
      }}>
        <h1 className="font-700 text-18 text-center text-[#FFFFFF]">Quizwala</h1>
      </button>
    </div>
  );
};