import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AngleMode = "DEG" | "RAD";
type ButtonType = "normal" | "numpad" | "accent" | "small";
type FunctionName =
  | "sin"
  | "cos"
  | "tan"
  | "asin"
  | "acos"
  | "atan"
  | "log"
  | "ln"
  | "sqrt";
type Operator = "+" | "-" | "*" | "/" | "^" | "EXP" | "C" | "P";
type Token =
  | { type: "number"; value: number }
  | { type: "function"; value: FunctionName }
  | { type: "operator"; value: Operator }
  | { type: "leftParen" }
  | { type: "rightParen" }
  | { type: "factorial" }
  | { type: "percent" };

class CalculatorError extends Error {
  constructor(readonly kind: "math" | "syntax") {
    super(kind);
  }
}

function isLetter(value: string) {
  return /^[a-z]$/i.test(value);
}

function tokenize(expression: string, currentAns: number): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const functions: FunctionName[] = [
    "asin",
    "acos",
    "atan",
    "sqrt",
    "sin",
    "cos",
    "tan",
    "log",
    "ln",
  ];

  while (index < expression.length) {
    const char = expression[index];
    if (char.trim() === "") {
      index += 1;
      continue;
    }

    if (/\d|\./.test(char)) {
      let value = char;
      index += 1;
      while (index < expression.length && /[\d.]/.test(expression[index])) {
        value += expression[index];
        index += 1;
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new CalculatorError("syntax");
      tokens.push({ type: "number", value: parsed });
      continue;
    }

    if (expression.startsWith("Ans", index)) {
      tokens.push({ type: "number", value: currentAns });
      index += 3;
      continue;
    }

    if (char === "π") {
      tokens.push({ type: "number", value: Math.PI });
      index += 1;
      continue;
    }

    if (char === "e") {
      tokens.push({ type: "number", value: Math.E });
      index += 1;
      continue;
    }

    if (char === "√") {
      tokens.push({ type: "function", value: "sqrt" });
      index += 1;
      continue;
    }

    const fn = functions.find((name) => expression.startsWith(name, index));
    if (fn) {
      tokens.push({ type: "function", value: fn });
      index += fn.length;
      continue;
    }

    if (char === "+" || char === "-") {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "−") {
      tokens.push({ type: "operator", value: "-" });
      index += 1;
      continue;
    }

    if (char === "×" || char === "*") {
      tokens.push({ type: "operator", value: "*" });
      index += 1;
      continue;
    }

    if (char === "÷" || char === "/") {
      tokens.push({ type: "operator", value: "/" });
      index += 1;
      continue;
    }

    if (char === "^") {
      tokens.push({ type: "operator", value: "^" });
      index += 1;
      continue;
    }

    if (char === "E") {
      tokens.push({ type: "operator", value: "EXP" });
      index += 1;
      continue;
    }

    if (char === "C" || char === "P") {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "leftParen" });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "rightParen" });
      index += 1;
      continue;
    }

    if (char === "!") {
      tokens.push({ type: "factorial" });
      index += 1;
      continue;
    }

    if (char === "%") {
      tokens.push({ type: "percent" });
      index += 1;
      continue;
    }

    if (isLetter(char)) throw new CalculatorError("syntax");
    throw new CalculatorError("syntax");
  }

  return tokens;
}

function toRadians(value: number, mode: AngleMode) {
  return mode === "DEG" ? value * (Math.PI / 180) : value;
}

function fromRadians(value: number, mode: AngleMode) {
  return mode === "DEG" ? value * (180 / Math.PI) : value;
}

function factorial(value: number) {
  if (value < 0 || !Number.isInteger(value) || value > 170) {
    throw new CalculatorError("math");
  }
  let result = 1;
  for (let i = 2; i <= value; i += 1) result *= i;
  return result;
}

function permutation(n: number, r: number) {
  if (n < 0 || r < 0 || !Number.isInteger(n) || !Number.isInteger(r) || r > n) {
    throw new CalculatorError("math");
  }
  let result = 1;
  for (let i = 0; i < r; i += 1) result *= n - i;
  return result;
}

function combination(n: number, r: number) {
  const k = Math.min(r, n - r);
  return permutation(n, k) / factorial(k);
}

function applyFunction(name: FunctionName, value: number, mode: AngleMode) {
  switch (name) {
    case "sin":
      return Math.sin(toRadians(value, mode));
    case "cos":
      return Math.cos(toRadians(value, mode));
    case "tan":
      return Math.tan(toRadians(value, mode));
    case "asin":
      return fromRadians(Math.asin(value), mode);
    case "acos":
      return fromRadians(Math.acos(value), mode);
    case "atan":
      return fromRadians(Math.atan(value), mode);
    case "log":
      return Math.log10(value);
    case "ln":
      return Math.log(value);
    case "sqrt":
      return Math.sqrt(value);
  }
}

function isPrimaryStart(token: Token | undefined) {
  return (
    token?.type === "number" ||
    token?.type === "function" ||
    token?.type === "leftParen"
  );
}

class Parser {
  private index = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly mode: AngleMode,
  ) {}

  parse() {
    const value = this.parseAdditive();
    if (this.index !== this.tokens.length) throw new CalculatorError("syntax");
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new CalculatorError("math");
    }
    return value;
  }

  private peek() {
    return this.tokens[this.index];
  }

  private take() {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  private parseAdditive(): number {
    let left = this.parseMultiplicative();
    while (this.peek()?.type === "operator") {
      const op = this.peek();
      if (op.type !== "operator" || (op.value !== "+" && op.value !== "-"))
        break;
      this.take();
      const right = this.parseMultiplicative();
      left = op.value === "+" ? left + right : left - right;
    }
    return left;
  }

  private parseMultiplicative(): number {
    let left = this.parsePower();
    while (true) {
      const token = this.peek();
      if (token?.type === "operator") {
        if (token.value === "*" || token.value === "/") {
          this.take();
          const right = this.parsePower();
          left = token.value === "*" ? left * right : left / right;
          continue;
        }
        if (token.value === "EXP") {
          this.take();
          left *= Math.pow(10, this.parsePower());
          continue;
        }
        if (token.value === "C" || token.value === "P") {
          this.take();
          const right = this.parsePower();
          left =
            token.value === "C"
              ? combination(left, right)
              : permutation(left, right);
          continue;
        }
      }
      if (isPrimaryStart(token)) {
        left *= this.parsePower();
        continue;
      }
      return left;
    }
  }

  private parsePower(): number {
    const left = this.parseUnary();
    const token = this.peek();
    if (token?.type === "operator" && token.value === "^") {
      this.take();
      return Math.pow(left, this.parsePower());
    }
    return left;
  }

  private parseUnary(): number {
    const token = this.peek();
    if (
      token?.type === "operator" &&
      (token.value === "+" || token.value === "-")
    ) {
      this.take();
      const value = this.parseUnary();
      return token.value === "-" ? -value : value;
    }
    if (token?.type === "function") {
      this.take();
      return applyFunction(token.value, this.parseUnary(), this.mode);
    }
    return this.parsePostfix();
  }

  private parsePostfix(): number {
    let value = this.parsePrimary();
    while (true) {
      const token = this.peek();
      if (token?.type === "factorial") {
        this.take();
        value = factorial(value);
        continue;
      }
      if (token?.type === "percent") {
        this.take();
        value /= 100;
        continue;
      }
      return value;
    }
  }

  private parsePrimary(): number {
    const token = this.take();
    if (!token) throw new CalculatorError("syntax");
    if (token.type === "number") return token.value;
    if (token.type === "leftParen") {
      const value = this.parseAdditive();
      if (this.peek()?.type !== "rightParen")
        throw new CalculatorError("syntax");
      this.take();
      return value;
    }
    throw new CalculatorError("syntax");
  }
}

function evaluateMath(expression: string, mode: AngleMode, currentAns: number) {
  if (!expression) return "";
  try {
    const result = new Parser(tokenize(expression, currentAns), mode).parse();
    return Number.parseFloat(result.toPrecision(12)).toString();
  } catch (error) {
    if (error instanceof CalculatorError && error.kind === "math") {
      return "Math ERROR";
    }
    return "Syntax ERROR";
  }
}

interface CalcButtonProps {
  label: string;
  shiftLabel?: string;
  alphaLabel?: string;
  blueLabel?: string;
  type?: ButtonType;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  scale: number;
}

interface RenderButtonOptions {
  shiftLabel?: string;
  shiftValue?: string;
  alphaLabel?: string;
  alphaValue?: string;
  blueLabel?: string;
  type?: ButtonType;
  style?: StyleProp<ViewStyle>;
}

function CalcButton({
  label,
  shiftLabel,
  alphaLabel,
  blueLabel,
  type = "normal",
  style,
  onPress,
  scale,
}: CalcButtonProps) {
  const metrics = {
    small: { button: 28, wrapper: 44, font: 12 },
    normal: { button: 40, wrapper: 56, font: 14 },
    numpad: { button: 42, wrapper: 58, font: 16 },
    accent: { button: 42, wrapper: 58, font: 13 },
  }[type];
  const buttonStyle =
    type === "accent"
      ? styles.accentButton
      : type === "numpad"
        ? styles.numpadButton
        : styles.normalButton;
  const hasLeft = Boolean(shiftLabel);
  const hasRight = Boolean(alphaLabel || blueLabel);

  return (
    <View
      style={[styles.buttonWrapper, { height: metrics.wrapper * scale }, style]}
    >
      <View style={styles.labelRow} pointerEvents="none">
        {hasLeft && !hasRight ? (
          <Text
            style={[styles.shiftLabel, styles.centerLabel]}
            numberOfLines={1}
          >
            {shiftLabel}
          </Text>
        ) : null}
        {hasLeft && hasRight ? (
          <>
            <Text style={styles.shiftLabel} numberOfLines={1}>
              {shiftLabel}
            </Text>
            <View style={styles.rightLabels}>
              {blueLabel ? (
                <Text style={styles.blueLabel} numberOfLines={1}>
                  {blueLabel}
                </Text>
              ) : null}
              {alphaLabel ? (
                <Text style={styles.alphaLabel} numberOfLines={1}>
                  {alphaLabel}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
        {!hasLeft && hasRight ? (
          <View style={styles.leftLabels}>
            {blueLabel ? (
              <Text style={styles.blueLabel} numberOfLines={1}>
                {blueLabel}
              </Text>
            ) : null}
            {alphaLabel ? (
              <Text style={styles.alphaLabel} numberOfLines={1}>
                {alphaLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.button,
          buttonStyle,
          {
            height: metrics.button * scale,
            borderRadius: 8 * scale,
            transform: [{ translateY: pressed ? 2 : 0 }],
          },
          pressed ? styles.buttonPressed : null,
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            {
              fontSize: metrics.font * scale,
              lineHeight: (metrics.font + 3) * scale,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

export function ScientificCalculator() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [displayExp, setDisplayExp] = useState("");
  const [displayResult, setDisplayResult] = useState("");
  const [ans, setAns] = useState(0);
  const [isShift, setIsShift] = useState(false);
  const [isAlpha, setIsAlpha] = useState(false);
  const [angleMode, setAngleMode] = useState<AngleMode>("DEG");

  const shortest = Math.min(width, height);
  const isTablet = shortest >= 600;
  const isLandscape = width > height;
  const useSplit = isTablet && isLandscape && width >= 840;
  const scale = useMemo(() => {
    if (useSplit) return 1.08;
    if (isTablet) return 1.12;
    return Math.min(1, Math.max(0.88, width / 380));
  }, [isTablet, useSplit, width]);
  const shellWidth = Math.min(
    width - 28,
    useSplit ? 920 : isTablet ? 500 : 360,
  );
  const bodyPadding = (useSplit ? 22 : 18) * scale;
  const bodyInnerWidth = shellWidth - bodyPadding * 2;
  const keypadWidth = useSplit ? (bodyInnerWidth - 22) / 1.8 : bodyInnerWidth;
  const scientificButtonStyle = useMemo<StyleProp<ViewStyle>>(
    () => ({ width: (keypadWidth - 30) / 6 }),
    [keypadWidth],
  );
  const numpadButtonStyle = useMemo<StyleProp<ViewStyle>>(
    () => ({ width: (keypadWidth - 28) / 5 }),
    [keypadWidth],
  );

  const haptic = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  const handleKey = useCallback(
    (val: string, shiftVal?: string, alphaVal?: string) => {
      haptic();
      let inputToAppend = val;
      if (isShift && shiftVal != null) {
        inputToAppend = shiftVal;
      } else if (isAlpha && alphaVal != null) {
        inputToAppend = alphaVal;
      }

      if (inputToAppend === "AC") {
        setDisplayExp("");
        setDisplayResult("");
        setIsShift(false);
        setIsAlpha(false);
        return;
      }

      if (inputToAppend === "DEL") {
        setDisplayExp((prev) => prev.slice(0, -1));
        setDisplayResult("");
        return;
      }

      if (inputToAppend === "=") {
        const res = evaluateMath(displayExp, angleMode, ans);
        setDisplayResult(res);
        if (res !== "Syntax ERROR" && res !== "Math ERROR" && res !== "") {
          setAns(Number(res));
        }
        setIsShift(false);
        setIsAlpha(false);
        return;
      }

      if (inputToAppend === "SHIFT") {
        setIsShift((prev) => !prev);
        setIsAlpha(false);
        return;
      }

      if (inputToAppend === "ALPHA") {
        setIsAlpha((prev) => !prev);
        setIsShift(false);
        return;
      }

      if (inputToAppend === "MODE") {
        setAngleMode((prev) => (prev === "DEG" ? "RAD" : "DEG"));
        setIsShift(false);
        setIsAlpha(false);
        return;
      }

      if (inputToAppend === "") {
        setIsShift(false);
        setIsAlpha(false);
        return;
      }

      setDisplayExp((prev) => prev + inputToAppend);
      setDisplayResult("");
      setIsShift(false);
      setIsAlpha(false);
    },
    [angleMode, ans, displayExp, haptic, isAlpha, isShift],
  );

  const renderButton = useCallback(
    (label: string, value: string, options?: RenderButtonOptions) => (
      <CalcButton
        label={label}
        shiftLabel={options?.shiftLabel}
        alphaLabel={options?.alphaLabel}
        blueLabel={options?.blueLabel}
        type={options?.type}
        style={options?.style}
        scale={scale}
        onPress={() =>
          handleKey(value, options?.shiftValue, options?.alphaValue)
        }
      />
    ),
    [handleKey, scale],
  );
  const renderScientificButton = useCallback(
    (label: string, value: string, options?: RenderButtonOptions) =>
      renderButton(label, value, {
        ...options,
        style: [scientificButtonStyle, options?.style],
      }),
    [renderButton, scientificButtonStyle],
  );
  const renderNumpadButton = useCallback(
    (label: string, value: string, options?: RenderButtonOptions) =>
      renderButton(label, value, {
        ...options,
        style: [numpadButtonStyle, options?.style],
      }),
    [numpadButtonStyle, renderButton],
  );

  const displayColumn = (
    <View style={[styles.displayColumn, useSplit ? styles.splitDisplay : null]}>
      <View style={styles.brandRow}>
        <Text style={styles.brand}>CASIO</Text>
        <Text style={styles.model}>fx-82MS</Text>
      </View>
      <Text style={styles.subtitle}>
        S-V.P.A.M. <Text style={styles.subtitleSmall}>2nd edition</Text>
      </Text>

      <View style={styles.screenBezel}>
        <View
          style={[styles.screen, { minHeight: (useSplit ? 138 : 104) * scale }]}
        >
          <View style={styles.statusRow}>
            <Text style={[styles.statusText, !isShift && styles.hiddenStatus]}>
              S
            </Text>
            <Text style={[styles.statusText, !isAlpha && styles.hiddenStatus]}>
              A
            </Text>
            <Text style={styles.statusText}>{angleMode}</Text>
            <Text style={styles.statusText}>Ans {ans}</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.expressionScroll}
          >
            <Text
              style={[
                styles.expression,
                { fontSize: (useSplit ? 25 : 19) * scale },
              ]}
            >
              {displayExp}
            </Text>
          </ScrollView>
          <Text
            style={[styles.result, { fontSize: (useSplit ? 38 : 30) * scale }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {displayResult}
          </Text>
        </View>
      </View>

      {useSplit ? (
        <View style={styles.tabletHelpCard}>
          <Text style={styles.tabletHelpTitle}>Tablet ready</Text>
          <Text style={styles.tabletHelpText}>
            Landscape mode keeps the display beside the keypad for a native
            tablet layout.
          </Text>
        </View>
      ) : null}
    </View>
  );

  const keypad = (
    <View style={[styles.keypad, useSplit ? styles.splitKeypad : null]}>
      <View style={[styles.controlRow, { height: 82 * scale }]}>
        <View style={styles.roundButtonGroup}>
          <View style={styles.roundButtonStack}>
            <Text style={styles.shiftRoundLabel}>SHIFT</Text>
            <Pressable
              onPress={() => handleKey("SHIFT")}
              accessibilityRole="button"
              accessibilityLabel="SHIFT"
              style={[
                styles.roundButton,
                isShift ? styles.roundButtonActive : null,
                {
                  width: 36 * scale,
                  height: 36 * scale,
                  borderRadius: 18 * scale,
                },
              ]}
            />
          </View>
          <View style={styles.roundButtonStack}>
            <Text style={styles.alphaRoundLabel}>ALPHA</Text>
            <Pressable
              onPress={() => handleKey("ALPHA")}
              accessibilityRole="button"
              accessibilityLabel="ALPHA"
              style={[
                styles.roundButton,
                isAlpha ? styles.roundButtonActive : null,
                {
                  width: 36 * scale,
                  height: 36 * scale,
                  borderRadius: 18 * scale,
                },
              ]}
            />
          </View>
        </View>

        <View
          style={[
            styles.dpad,
            {
              width: 80 * scale,
              height: 80 * scale,
              borderRadius: 40 * scale,
              marginLeft: -40 * scale,
            },
          ]}
        >
          <Text style={[styles.dpadArrow, styles.dpadUp]}>▲</Text>
          <Text style={[styles.dpadArrow, styles.dpadDown]}>▼</Text>
          <Text style={[styles.dpadArrow, styles.dpadLeft]}>◀</Text>
          <Text style={[styles.dpadArrow, styles.dpadRight]}>▶</Text>
          <View
            style={[
              styles.dpadCenter,
              {
                width: 22 * scale,
                height: 22 * scale,
                borderRadius: 11 * scale,
              },
            ]}
          />
        </View>

        <View style={styles.roundButtonGroup}>
          <View style={styles.roundButtonStack}>
            <View style={styles.modeLabelRow}>
              <Text style={styles.whiteRoundLabel}>MODE</Text>
              <Text style={styles.shiftRoundLabel}>CLR</Text>
            </View>
            <Pressable
              onPress={() => handleKey("MODE")}
              accessibilityRole="button"
              accessibilityLabel="MODE"
              style={[
                styles.roundButton,
                {
                  width: 36 * scale,
                  height: 36 * scale,
                  borderRadius: 18 * scale,
                },
              ]}
            />
          </View>
          <View style={styles.roundButtonStack}>
            <Text style={styles.whiteRoundLabel}>ON</Text>
            <Pressable
              onPress={() => handleKey("AC")}
              accessibilityRole="button"
              accessibilityLabel="ON"
              style={[
                styles.roundButton,
                {
                  width: 36 * scale,
                  height: 36 * scale,
                  borderRadius: 18 * scale,
                },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={styles.scientificTopRow}>
        <View style={styles.scientificPair}>
          {renderButton("x⁻¹", "^-1", {
            shiftLabel: "x!",
            shiftValue: "!",
            type: "small",
            style: styles.topSmallButton,
          })}
          {renderButton("nCr", "C", {
            shiftLabel: "nPr",
            shiftValue: "P",
            type: "small",
            style: styles.topSmallButton,
          })}
        </View>
        <View style={styles.scientificPair}>
          {renderButton("Pol(", "Pol(", {
            shiftLabel: "Rec(",
            shiftValue: "Rec(",
            alphaLabel: ":",
            alphaValue: ":",
            type: "small",
            style: styles.topSmallButton,
          })}
          {renderButton("x³", "^3", {
            shiftLabel: "³√",
            shiftValue: "^(1/3)",
            type: "small",
            style: styles.topSmallButton,
          })}
        </View>
      </View>

      <View style={styles.grid6}>
        {renderScientificButton("ab/c", "/", {
          shiftLabel: "d/c",
          type: "small",
        })}
        {renderScientificButton("√", "√(", { type: "small" })}
        {renderScientificButton("x²", "^2", { type: "small" })}
        {renderScientificButton("^", "^", {
          shiftLabel: "ˣ√",
          shiftValue: "^(1/",
          type: "small",
        })}
        {renderScientificButton("log", "log(", {
          shiftLabel: "10ˣ",
          shiftValue: "10^(",
          type: "small",
        })}
        {renderScientificButton("ln", "ln(", {
          shiftLabel: "eˣ",
          shiftValue: "e^(",
          alphaLabel: "e",
          alphaValue: "e",
          type: "small",
        })}

        {renderScientificButton("(-)", "-", {
          alphaLabel: "A",
          alphaValue: "A",
          type: "small",
        })}
        {renderScientificButton("°'\"", "", {
          shiftLabel: "←",
          alphaLabel: "B",
          alphaValue: "B",
          type: "small",
        })}
        {renderScientificButton("hyp", "", {
          alphaLabel: "C",
          alphaValue: "C",
          type: "small",
        })}
        {renderScientificButton("sin", "sin(", {
          shiftLabel: "sin⁻¹",
          shiftValue: "asin(",
          alphaLabel: "D",
          alphaValue: "D",
          type: "small",
        })}
        {renderScientificButton("cos", "cos(", {
          shiftLabel: "cos⁻¹",
          shiftValue: "acos(",
          alphaLabel: "E",
          alphaValue: "E",
          type: "small",
        })}
        {renderScientificButton("tan", "tan(", {
          shiftLabel: "tan⁻¹",
          shiftValue: "atan(",
          alphaLabel: "F",
          alphaValue: "F",
          type: "small",
        })}

        {renderScientificButton("RCL", "", {
          shiftLabel: "STO",
          type: "small",
        })}
        {renderScientificButton("ENG", "", { shiftLabel: "←", type: "small" })}
        {renderScientificButton("(", "(", {
          alphaLabel: "X",
          alphaValue: "X",
          type: "small",
        })}
        {renderScientificButton(")", ")", {
          shiftLabel: ";",
          shiftValue: ";",
          alphaLabel: "Y",
          alphaValue: "Y",
          type: "small",
        })}
        {renderScientificButton(",", ",", {
          alphaLabel: "M",
          alphaValue: "M",
          type: "small",
        })}
        {renderScientificButton("M+", "", {
          shiftLabel: "M-",
          alphaLabel: "M",
          alphaValue: "M",
          type: "small",
        })}
      </View>

      <View style={styles.grid5}>
        {renderNumpadButton("7", "7", { type: "numpad" })}
        {renderNumpadButton("8", "8", { type: "numpad" })}
        {renderNumpadButton("9", "9", { type: "numpad" })}
        {renderNumpadButton("DEL", "DEL", {
          shiftLabel: "INS",
          shiftValue: "",
          type: "accent",
        })}
        {renderNumpadButton("AC", "AC", {
          shiftLabel: "OFF",
          shiftValue: "AC",
          blueLabel: "DT CL",
          type: "accent",
        })}

        {renderNumpadButton("4", "4", { type: "numpad" })}
        {renderNumpadButton("5", "5", { type: "numpad" })}
        {renderNumpadButton("6", "6", { type: "numpad" })}
        {renderNumpadButton("×", "×")}
        {renderNumpadButton("÷", "÷")}

        {renderNumpadButton("1", "1", {
          shiftLabel: "[S-SUM]",
          type: "numpad",
        })}
        {renderNumpadButton("2", "2", {
          shiftLabel: "[S-VAR]",
          type: "numpad",
        })}
        {renderNumpadButton("3", "3", { type: "numpad" })}
        {renderNumpadButton("+", "+")}
        {renderNumpadButton("−", "−")}

        {renderNumpadButton("0", "0", {
          shiftLabel: "Rnd",
          shiftValue: "0",
          type: "numpad",
        })}
        {renderNumpadButton(".", ".", {
          shiftLabel: "Ran#",
          shiftValue: ".",
          type: "numpad",
        })}
        {renderNumpadButton("×10ˣ", "E", {
          shiftLabel: "π",
          shiftValue: "π",
        })}
        {renderNumpadButton("Ans", "Ans", {
          shiftLabel: "DRG▶",
          shiftValue: "Ans",
        })}
        {renderNumpadButton("=", "=", {
          shiftLabel: "%",
          shiftValue: "%",
        })}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.pageContent,
        {
          paddingTop: insets.top + 18,
          paddingBottom: insets.bottom + 18,
          minHeight: height,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.calculatorBody,
          {
            width: shellWidth,
            padding: bodyPadding,
            borderRadius: (useSplit ? 32 : 28) * scale,
          },
          useSplit ? styles.calculatorBodySplit : null,
        ]}
      >
        {displayColumn}
        {keypad}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#e0e0e0",
  },
  pageContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  calculatorBody: {
    backgroundColor: "#363231",
    borderWidth: 2,
    borderColor: "#4f4a48",
    shadowColor: "#000",
    shadowOpacity: 0.38,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
  calculatorBodySplit: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 22,
  },
  displayColumn: {
    gap: 12,
  },
  splitDisplay: {
    flex: 0.8,
    justifyContent: "center",
  },
  splitKeypad: {
    flex: 1,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  brand: {
    color: "#fff",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
  },
  model: {
    color: "#a09a97",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  subtitle: {
    color: "#f7f2ef",
    opacity: 0.82,
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2.1,
    marginBottom: 2,
  },
  subtitleSmall: {
    fontSize: 8,
    letterSpacing: 0,
  },
  screenBezel: {
    backgroundColor: "#24211f",
    padding: 8,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
    marginBottom: 10,
  },
  screen: {
    backgroundColor: "#96a492",
    borderColor: "#768573",
    borderWidth: 2,
    borderRadius: 8,
    padding: 8,
    overflow: "hidden",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 18,
  },
  statusText: {
    color: "#24301f",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  hiddenStatus: {
    opacity: 0,
  },
  expressionScroll: {
    flexGrow: 1,
    alignItems: "center",
    minWidth: "100%",
  },
  expression: {
    color: "#10170f",
    fontFamily: Platform.select({
      ios: "Courier",
      android: "monospace",
      default: "monospace",
    }),
    letterSpacing: 1.2,
    minHeight: 34,
  },
  result: {
    color: "#10170f",
    textAlign: "right",
    fontFamily: Platform.select({
      ios: "Courier-Bold",
      android: "monospace",
      default: "monospace",
    }),
    fontWeight: "700",
    minHeight: 42,
  },
  tabletHelpCard: {
    backgroundColor: "#2b2726",
    borderColor: "#4f4a48",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  tabletHelpTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  tabletHelpText: {
    color: "#bcb4b0",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_500Medium",
  },
  keypad: {
    gap: 5,
  },
  controlRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  roundButtonGroup: {
    flexDirection: "row",
    gap: 14,
  },
  roundButtonStack: {
    alignItems: "center",
    gap: 5,
  },
  shiftRoundLabel: {
    color: "#d5ad40",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  alphaRoundLabel: {
    color: "#cc5669",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  whiteRoundLabel: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
  },
  modeLabelRow: {
    flexDirection: "row",
    gap: 4,
  },
  roundButton: {
    backgroundColor: "#2a2624",
    borderColor: "#3a3533",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  roundButtonActive: {
    backgroundColor: "#463a27",
    borderColor: "#d5ad40",
  },
  dpad: {
    position: "absolute",
    left: "50%",
    top: -4,
    backgroundColor: "#221e1d",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  dpadCenter: {
    backgroundColor: "#1b1817",
    borderWidth: 1,
    borderColor: "#111",
  },
  dpadArrow: {
    position: "absolute",
    color: "#9ca3af",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  dpadUp: {
    top: 6,
  },
  dpadDown: {
    bottom: 6,
  },
  dpadLeft: {
    left: 8,
  },
  dpadRight: {
    right: 8,
  },
  scientificTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  scientificPair: {
    flexDirection: "row",
    gap: 12,
  },
  topSmallButton: {
    width: 46,
  },
  grid6: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  grid5: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    paddingTop: 12,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#4f4a48",
  },
  buttonWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  labelRow: {
    position: "absolute",
    top: 0,
    left: 1,
    right: 1,
    minHeight: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  shiftLabel: {
    color: "#d5ad40",
    fontSize: 8,
    lineHeight: 10,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  alphaLabel: {
    color: "#cc5669",
    fontSize: 8,
    lineHeight: 9,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
  },
  blueLabel: {
    color: "#489ea8",
    fontSize: 7,
    lineHeight: 8,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
  },
  centerLabel: {
    textAlign: "center",
  },
  rightLabels: {
    flex: 1,
    alignItems: "flex-end",
  },
  leftLabels: {
    alignItems: "flex-start",
    width: "100%",
  },
  button: {
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  normalButton: {
    backgroundColor: "#2a2624",
    borderColor: "#3a3533",
  },
  numpadButton: {
    backgroundColor: "#4a4441",
    borderColor: "#59524f",
  },
  accentButton: {
    backgroundColor: "#c44961",
    borderColor: "#d66076",
  },
  buttonPressed: {
    opacity: 0.86,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});
