"use client";
import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Sheet from "@/components/ui/native-swipeable-sheets";
import { Button } from './ui/button';
import Link from 'next/link';
import { FaYoutube, FaInstagram, FaTiktok, FaDiscord, FaTwitter } from 'react-icons/fa';


export const NavHeader = () => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigationLinks = [
    { name: "About", href: "#about" },
    { name: "Features", href: "#features" },
    { name: "Roadmap", href: "#roadmap" },
    { name: "How to Buy", href: "#buy" },
    { name: "FAQ", href: "#faq" },
  ];

  const socialLinks = [
    { icon: <FaYoutube size={24} />, href: "https://youtube.com" },
    { icon: <FaInstagram size={24} />, href: "https://instagram.com" },
    { icon: <FaTiktok size={24} />, href: "https://tiktok.com" },
    { icon: <FaDiscord size={24} />, href: "https://discord.com" },
    { icon: <FaTwitter size={24} />, href: "https://twitter.com" },
  ];

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setSheetOpen(false);
  };

  return (
    <nav className="fixed top-0 bg-white/80 backdrop-blur-xl z-50 w-full px-4 py-2">
      {/* Main container */}
      <div className="w-full max-w-[374px] lg:max-w-6xl mx-auto h-fit p-2 bg-transparent rounded-[35px]">
        
        {/* Inner content wrapper */}
        <div className="flex justify-between items-center h-full px-2.5">
          
          {/* Logo */}
          <div className="font-geist text-[30px] leading-9 text-black font-extrabold tracking-tight">
            <span>Slashy</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-6">
            {navigationLinks.map((link) => (
              <button key={link.name} onClick={() => scrollToSection(link.href)} className="font-geist text-xl font-semibold text-black">
                {link.name}
              </button>
            ))}
          </div>
          
          {/* Right side controls */}
          <div className="flex gap-2 items-center">
            
            {/* Social Icons for Desktop */}
            <div className="hidden lg:flex items-center gap-3">
              {socialLinks.map((social, index) => (
                <Link key={index} href={social.href} target="_blank" rel="noopener noreferrer" className="text-black">
                  {social.icon}
                </Link>
              ))}
            </div>

            {/* Merch button */}
            <button className="px-[30px] py-3 bg-black rounded-full">
              <span className="font-geist text-xl font-semibold text-white">
                Download
              </span>
            </button>
            
            {/* Menu button for Mobile */}
            <button onClick={() => setSheetOpen(true)} className="lg:hidden w-[50px] h-[50px] bg-black rounded-full flex items-center justify-center">
              <Menu className="w-5 stroke-3 text-white" />
            </button>
            
          </div>
        </div>
      </div>

      {/* Mobile Navigation Sheet */}
      <Sheet open={sheetOpen} close={() => setSheetOpen(false)} title="Navigation" className="bg-card max-w-[360px]">
        <div className="flex flex-col items-center justify-center  text-center text-card-foreground p-12">
          <div className="flex flex-col justify-center items-start gap-0 w-[300px]">
            {navigationLinks.map((link) => (
              <Button
                key={link.name}
                onClick={() => scrollToSection(link.href)}
                className="font-medium text-2xl py-6 justify-start text-foreground hover:bg-muted w-full bg-card"
              >
                {link.name}
              </Button>
            ))}
          </div>
        </div>
      </Sheet>
    </nav>
  );
};

export default NavHeader;