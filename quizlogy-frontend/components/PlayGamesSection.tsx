'use client';

type Game = {
  name: string;
  thumbnail: string;
  url: string;
};

const PUNO_MORE_GAMES_URL =
  'https://punogames.com?utm_source=quizwebsite&utm_medium=biowikiinfo&utm_campaign=block';

const GAMES: Game[] = [
  {
    name: 'Block Mania',
    thumbnail:
      'https://www.punogames.com/_next/image?url=https%3A%2F%2Fwww.punogames.com%2Fassets%2Fneon-bricks%2Ffeatured_img%2Ffeatured_img-1752064557330.jpg&w=640&q=75',
    url: 'https://punogames.com/neon-bricks?utm_source=quizwebsite&utm_medium=biowikiinfo&utm_campaign=block',
  },
  {
    name: 'Mergis',
    thumbnail:
      'https://www.punogames.com/_next/image?url=https%3A%2F%2Fwww.punogames.com%2Fassets%2Fmergis%2Ffeatured_img%2Ffeatured_img-1723626920793.jpg&w=640&q=75',
    url: 'https://punogames.com/mergis?utm_source=quizwebsite&utm_medium=biowikiinfo&utm_campaign=block',
  },
  {
    name: 'Ninja Fruit Slice',
    thumbnail:
      'https://www.punogames.com/_next/image?url=https%3A%2F%2Fwww.punogames.com%2Fassets%2Fninja-fruit-slice%2Ffeatured_img%2Ffeatured_img-1753954112477.png&w=640&q=75',
    url: 'https://punogames.com/ninja-fruit-slice?utm_source=quizwebsite&utm_medium=biowikiinfo&utm_campaign=block',
  },
  {
    name: 'Pool 8 Ball',
    thumbnail:
      'https://www.punogames.com/_next/image?url=https%3A%2F%2Fwww.punogames.com%2Fassets%2Fpool-8-ball%2Ffeatured_img%2Ffeatured_img-1723894000837.jpg&w=640&q=75',
    url: 'https://punogames.com/pool-8-ball?utm_source=quizwebsite&utm_medium=biowikiinfo&utm_campaign=block',
  },
  {
    name: 'Fighter Jet',
    thumbnail:
      'https://www.punogames.com/_next/image?url=https%3A%2F%2Fwww.punogames.com%2Fassets%2Ffighter-jet%2Ffeatured_img%2Ffeatured_img-1724227103888.jpg&w=640&q=75',
    url: 'https://punogames.com/fighter-jet?utm_source=quizwebsite&utm_medium=biowikiinfo&utm_campaign=block',
  },
  {
    name: 'Liquid Sort',
    thumbnail:
      'https://www.punogames.com/_next/image?url=https%3A%2F%2Fwww.punogames.com%2Fassets%2Fliquid-sort%2Ffeatured_img%2Ffeatured_img-1724136427719.jpg&w=640&q=75',
    url: 'https://punogames.com/liquid-sort?utm_source=quizwebsite&utm_medium=biowikiinfo&utm_campaign=block',
  },
];

export function PlayGamesSection() {
  return (
    <div className="  bg-[#FFF6D9]  p-5">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-[#0D0009] text-xl font-bold mb-2">Play Games</h1>
          {/* Powered By */}
          <div className="flex items-center gap-2">
            <p className="text-[#0D0009]/70 text-sm">Powered By</p>
            <img src="/puno-games.png" alt="PUNO & GAMES" className="h-5 object-contain" />
          </div>
        </div>
        <button
          onClick={() => {
            window.open(PUNO_MORE_GAMES_URL, '_blank', 'noopener,noreferrer');
          }}
          className="text-[#0D0009] underline hover:text-[#0D0009]/80 transition-colors text-sm font-semibold"
        >
          More Games
        </button>
      </div>

      {/* Games Grid */}
      <div className="grid grid-cols-3 gap-4">
        {GAMES.map((game) => (
          <div
            key={game.url}
            className="bg-[#0D0009] rounded-xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform shadow-lg"
            onClick={() => {
              window.open(game.url, '_blank', 'noopener,noreferrer');
            }}
          >
            {/* Game Thumbnail */}
            <div
              className="relative overflow-hidden w-full"
              style={{ 
                aspectRatio: '140/100',
                borderTopLeftRadius: '0.75rem',
                borderTopRightRadius: '0.75rem',
                borderBottomLeftRadius: '0',
                borderBottomRightRadius: '0'
              }}
            >
              <img
                src={game.thumbnail}
                alt={game.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  // Fallback to gradient if image fails to load
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.style.background = 'linear-gradient(to bottom right, #3b82f6, #9333ea)';
                  }
                }}
              />
            </div>

            {/* Game Title */}
            <div 
              className="bg-[#0D0009] px-3 py-2"
              style={{
                borderBottomLeftRadius: '0.75rem',
                borderBottomRightRadius: '0.75rem',
                borderTop: '1px solid #0D0009'
              }}
            >
              <p className="text-[#FFFFFF] font-bold text-xs text-center">{game.name}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

