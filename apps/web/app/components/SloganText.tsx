import React from 'react';

export default function SloganText() {
  return (
    <div className="mb-6">
      {/* <div>
        <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-medium text-gray-300 mb-2 drop-shadow-md px-2 inline-flex items-center justify-center">
          <span className="sr-only">Slogan:</span>
          <span className="relative inline-flex items-center">
            <span>"</span>
            <span className="mr-2 text-red-600 font-bold">Stop</span>
            <span className="mr-2">recording</span>
            <span className="relative inline-block mx-2">
              <span className="text-white/90 font-semibold">pixels</span>
              <svg
                className="absolute inset-0 -translate-y-1/3"
                width="98"
                height="108"
                viewBox="0 0 98 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  d="M4 12c14-6 24-9 34-6 10 3 26 6 42 0"
                  stroke="#e60000"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-90"
                />
                <path
                  d="M4 12c14-6 24-9 34-6 10 3 26 6 42 0"
                  stroke="#fff"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6 6"
                  opacity="0.18"
                />
              </svg>
            </span>

            <span className="ml-2 flex items-center">
              <span className="text-cyan-300 font-semibold mx-2">
                instead capture
              </span>
              <span className="relative inline-flex items-center ml-1">
                <span className="text-white/100 font-bold px-1">DOM"</span>
                <svg
                  width="80"
                  height="90"
                  viewBox="0 0 50 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute -top-7 -left-3"
                  aria-hidden
                >
                  <ellipse
                    cx="30"
                    cy="20"
                    rx="28"
                    ry="15"
                    stroke="#7cff67"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity="0.9"
                  />
                  <path
                    d="M8 28c6-6 16-12 22-12s16 6 22 12"
                    stroke="#7cff67"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="4 6"
                    opacity="0.6"
                  />
                </svg>
                <svg
                  width="30"
                  height="24"
                  viewBox="0 0 30 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute -right-6 -bottom-6 rotate-12"
                  aria-hidden
                >
                  <path
                    d="M2 22c6-3 14-6 24-14"
                    stroke="#ffd166"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M24 8c0 1 1 2 2 2s2-1 2-2-1-2-2-2-2 1-2 2z"
                    fill="#ffd166"
                  />
                </svg>
              </span>
            </span>
          </span>
        </p>
      </div> */}

      <p className="text-lg sm:text-xl md:text-2xl font-serif italic font-normal tracking-tight text-foreground/90 px-2">
        &quot;Stop recording pixels, instead capture DOM&quot;
      </p>
    </div>
  );
}
