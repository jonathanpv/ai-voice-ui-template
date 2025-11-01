"use client";

import { cn } from "@/lib/utils";
import React from "react";
import { TbX } from "react-icons/tb";
import { Drawer } from "vaul";

interface Props {
  children: React.ReactNode;
  title: string; // required for accessibility
  open: boolean;
  close: () => void;
  className?: string;
}

export default function Sheet({
  children,
  open,
  close,
  className,
  title,
}: Props) {
  return (
    <Drawer.Root shouldScaleBackground={false} open={open} onClose={close}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-500 bg-black/40 backdrop-blur-xs" />
        <Drawer.Content
          style={
            {
              "--initial-transform": "calc(100% + 16px)",
            } as React.CSSProperties
          }
          className={cn(
            "fixed -inset-x-4 bottom-4 z-501 mx-auto w-[calc(100vw-32px)] overflow-hidden outline-hidden md:mx-auto md:w-[650px]",
            "rounded-3xl bg-white",
            className,
          )}
        >
          <Drawer.Title className="sr-only hidden">{title}</Drawer.Title>
          <div className="relative">
            <div className="absolute top-4 left-1/2 h-1.5 w-12 shrink-0 -translate-x-1/2 cursor-grab rounded-full bg-gray-300" />
            <button
              onClick={close}
              className="absolute top-0 right-0 m-4 flex size-7 cursor-pointer items-center justify-center rounded-full bg-gray-200 text-gray-600"
            >
              <TbX />
            </button>

            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
