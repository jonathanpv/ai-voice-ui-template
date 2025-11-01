'use client';
import { cn } from '@/lib/utils';
import { useScroll } from 'motion/react';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sheet from './native-swipeable-sheet';

export function Navigation9() {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { scrollYProgress } = useScroll({
    offset: ['start start', '100px start'],
  });

  scrollYProgress.on('change', (latest) => {
    setHasScrolled(latest > 0);
  });

  return (
    <div className="font-geist sticky top-8 z-50 mx-auto w-full max-w-7xl px-6 lg:px-8">
        <Sheet open={isMenuOpen} close={() => setIsMenuOpen(false)} title="Cool Daddy" className="w-[100vw] max-w-[500px] bottom-0 rounded-b-none">
        <div className="flex flex-col items-center justify-center gap-8  py-12 text-center text-black ">
          <div className="flex flex-col gap-5 justify-center items-start w-full px-[28px] ">
            <p className="font-bold text-2xl">Product</p>
            <p className="font-bold text-2xl">Features</p>
            <p className="font-bold text-2xl">Pricing</p>
            <p className="font-bold  text-2xl">About</p>
          </div>
          <div className=" w-full px-4 flex justify-center  items-center">
            <button
              onClick={() => setIsMenuOpen(false)}
              className="cursor-pointer rounded-full bg-black h-14 text-xl w-full min-w-[319px]  max-w-[459px] font-bold text-white"
            >
              Close
            </button>
          </div>
        </div>
      </Sheet>

        <div
          className={cn(
            'flex items-center justify-between transition-all duration-200 ease-out max-w-[1110px] mx-auto',
            hasScrolled
              ? 'w-full lg:w-[493px] rounded-[18px] border border-[rgba(10,10,10,0.07)] bg-white p-2 backdrop-blur-[5px]'
              : 'w-full rounded-full border-transparent bg-transparent p-2'
          )}
        >
            {/* Logo */}
            <div className="overflow-clip flex items-center justify-start gap-2.5 pl-2">
              <span className="text-lg font-bold text-[#0A0D14]">slashy</span>
            </div>

            {/* Nav Links */}
            <div className="hidden lg:flex items-center gap-1">
              <a href="#" className="flex h-8 items-center justify-center rounded-lg bg-transparent px-2">
                <span className="text-sm font-semibold text-[#78797E] px-1">Product</span>
              </a>
              <a href="#" className="flex h-8 items-center justify-center rounded-lg bg-transparent px-2">
                <span className="text-sm font-semibold text-[#78797E] px-1">Features</span>
              </a>
              <a href="#" className="flex h-8 items-center justify-center rounded-lg bg-transparent px-2">
                <span className="text-sm font-semibold text-[#78797E] px-1">Pricing</span>
              </a>
              <a href="#" className="flex h-8 items-center justify-center rounded-lg bg-transparent px-2">
                <span className="text-sm font-semibold text-[#78797E] px-1">About</span>
              </a>
            </div>

            {/* Auth Link */}
            <div className="hidden lg:block w-[71px]">
              <a href="#" className="flex w-full h-8 items-center justify-start rounded-lg bg-transparent px-2">
                <span className="text-lg font-semibold text-[#000] px-1">login</span>
              </a>
            </div>

            {/* Hamburger Menu */}
            <div className="lg:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
                <Menu className="h-6 w-6" />
              </button>
            </div>
        </div>
    </div>
  );
}