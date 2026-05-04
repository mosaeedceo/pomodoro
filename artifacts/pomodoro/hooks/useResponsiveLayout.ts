import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const shortest = Math.min(width, height);
    const isTablet = shortest >= 600;
    const isLandscape = width > height;
    const isSplitLandscape = isLandscape && height < 620;
    const isWide = width >= 840 && !isSplitLandscape;
    const maxContentWidth = isWide ? 980 : isTablet ? 720 : undefined;

    return {
      width,
      height,
      isTablet,
      isWide,
      isSplitLandscape,
      maxContentWidth,
    };
  }, [height, width]);
}
