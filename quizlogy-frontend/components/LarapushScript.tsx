'use client';

import Script from 'next/script';

export function LarapushScript() {
  return (
    <Script
      src="https://cdn.larapush.com/scripts/larapush-popup-5.0.0.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        // @ts-ignore
        if (typeof window !== 'undefined' && typeof window.LaraPush === "function") {
          // LoadLaraPush function
          // @ts-ignore
          new window.LaraPush(
            JSON.parse(atob('eyJmaXJlYmFzZUNvbmZpZyI6eyJwcm9qZWN0SWQiOiJub3RpZmljYXRpb25zLTIxNDE5IiwibWVzc2FnaW5nU2VuZGVySWQiOiIxMDExMzQ3MDU1NDM4IiwiYXBwSWQiOiIxOjEwMTEzNDcwNTU0Mzg6d2ViOjk4OWJiYjFiYTg1YjIzMjc3NmI0MWYiLCJhcGlLZXkiOiJBSXphU3lDc3ZQRFltQWQyTHVVaERmc0tCQ1ZlWDEtYTZJM2tYRTgifSwiZG9tYWluIjoiXC8iLCJzaXRlX3VybCI6IlwvIiwiYXBpX3VybCI6Imh0dHBzOlwvXC9ub3RpZmljYXRpb25zLnF1aXphbmdvbWVkaWEuY29tXC9hcGlcL3Rva2VuIiwic2VydmljZVdvcmtlciI6IlwvZmlyZWJhc2UtbWVzc2FnaW5nLXN3LmpzIiwidmFwaWRfcHVibGljX2tleSI6IkJQM2owenJLdW93Z2tKZVNUSlhCdXplNGZKVHFxODVmVThVaEpBblhQc282MXVGZmxvRlVnX3ZON0hBd2p4djRqa0hxcjVoSE1kZVdwR1FGWGRLU2ZCNCIsInJlZmVycmFsQ29kZSI6IllESkNFRiJ9')),
            JSON.parse(atob('eyJsb2dvIjoiaHR0cHM6XC9cL2Nkbi5sYXJhcHVzaC5jb21cL3VwbG9hZHNcL2JlbGwtbG9nby5qcGciLCJoZWFkaW5nIjoiV2VsY29tZSB0byBUZWNoQXR0Iiwic3ViaGVhZGluZyI6IldlbGNvbWUgdG8gcXVpeiB3ZWJzaXRlIiwidGhlbWVDb2xvciI6IiMwMDdiZmYiLCJhbGxvd1RleHQiOiJBbGxvdyIsImRlbnlUZXh0IjoiRGVueSIsImRlc2t0b3AiOiJlbmFibGUiLCJtb2JpbGUiOiJlbmFibGUiLCJtb2JpbGVMb2NhdGlvbiI6ImJvdHRvbSIsImRlbGF5IjoiMCIsInJlYXBwZWFyIjoiMCIsImJvdHRvbUJ1dHRvbiI6ImRpc2FibGUiLCJidXR0b25Ub1Vuc3Vic2NyaWJlIjpudWxsLCJsb2NrUGFnZUNvbnRlbnQiOiJkaXNhYmxlIiwiYmFja2Ryb3AiOiJkaXNhYmxlIiwicG9wdXBfdHlwZSI6Im1hbnVhbCJ9'))
          );
        }
      }}
    />
  );
}
