"use client";

import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  MouseEvent,
  ReactNode,
} from "react";
import styles from "./v2-button.module.css";

type V2ButtonBaseProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  href?: string;
  size?: "md" | "lg";
  variant?: "primary" | "secondary" | "ghost";
};

type V2ButtonProps =
  | (V2ButtonBaseProps &
      Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof V2ButtonBaseProps | "href"> & {
        href?: undefined;
      })
  | (V2ButtonBaseProps &
      Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof V2ButtonBaseProps | "href"> & {
        href: string;
      });

export function V2Button({
  children,
  className = "",
  disabled = false,
  fullWidth = false,
  href,
  size = "md",
  variant = "primary",
  ...props
}: V2ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    size === "lg" ? styles.large : "",
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    const { onClick, tabIndex, ...anchorProps } = props as Omit<
      AnchorHTMLAttributes<HTMLAnchorElement>,
      "href"
    >;
    const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    };

    return (
      <Link
        {...anchorProps}
        aria-disabled={disabled || undefined}
        className={classes}
        href={href}
        onClick={handleClick}
        tabIndex={disabled ? -1 : tabIndex}
      >
        {children}
      </Link>
    );
  }

  const buttonProps = props as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      {...buttonProps}
      className={classes}
      disabled={disabled}
      type={buttonProps.type ?? "button"}
    >
      {children}
    </button>
  );
}
