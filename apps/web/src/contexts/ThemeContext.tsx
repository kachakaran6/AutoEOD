import React, { createContext, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light" | "system"
export type AccentColor = "violet" | "skyblue" | "pink" | "yellow" | "monochrome"

export interface AccentColorOption {
  id: AccentColor
  label: string
  hex: string
  bgClass: string
  borderClass: string
  gradient: string
}

export const ACCENT_COLORS: AccentColorOption[] = [
  {
    id: "violet",
    label: "Violet",
    hex: "#8b5cf6",
    bgClass: "bg-violet-500/90",
    borderClass: "border-violet-500/50",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    id: "skyblue",
    label: "Sky Blue",
    hex: "#0ea5e9",
    bgClass: "bg-sky-500/90",
    borderClass: "border-sky-500/50",
    gradient: "from-sky-500 to-blue-500",
  },
  {
    id: "pink",
    label: "Pink",
    hex: "#f43f5e",
    bgClass: "bg-rose-500/90",
    borderClass: "border-rose-500/50",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    id: "yellow",
    label: "Yellow",
    hex: "#eab308",
    bgClass: "bg-amber-500/90",
    borderClass: "border-amber-500/50",
    gradient: "from-amber-500 to-yellow-500",
  },
  {
    id: "monochrome",
    label: "Monochrome (B/W)",
    hex: "#71717a",
    bgClass: "bg-zinc-700 dark:bg-zinc-300",
    borderClass: "border-zinc-500/50",
    gradient: "from-zinc-700 to-zinc-900 dark:from-zinc-200 dark:to-zinc-400",
  },
]

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  defaultAccent?: AccentColor
  storageKey?: string
  accentStorageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  accentColor: AccentColor
  setAccentColor: (accent: AccentColor) => void
  accentOptions: AccentColorOption[]
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  accentColor: "pink",
  setAccentColor: () => null,
  accentOptions: ACCENT_COLORS,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultAccent = "pink",
  storageKey = "vite-ui-theme",
  accentStorageKey = "autoeod-accent",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  const [accentColor, setAccentColor] = useState<AccentColor>(() => {
    const saved = localStorage.getItem(accentStorageKey) as AccentColor
    // Handle fallback if old deleted colors were saved in localStorage
    if (saved && ["violet", "skyblue", "pink", "yellow", "monochrome"].includes(saved)) {
      return saved
    }
    return defaultAccent
  })

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  useEffect(() => {
    const root = window.document.documentElement
    root.setAttribute("data-accent", accentColor)
  }, [accentColor])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme)
      setTheme(newTheme)
    },
    accentColor,
    setAccentColor: (newAccent: AccentColor) => {
      localStorage.setItem(accentStorageKey, newAccent)
      setAccentColor(newAccent)
    },
    accentOptions: ACCENT_COLORS,
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
