import React from "react";

/**
 * Format currency value
 */
export const formatCurrency = (value) => {
  if (!value) return "₹0";
  return `₹${(value || 0).toLocaleString("en-IN")}`;
};

/**
 * Render formatted text with bold, italic, underline
 */
export const renderFormattedText = (text, cellId, cellFormats) => {
  if (!text) return "-";

  const textStr = String(text);
  const formats = cellFormats[cellId] || [];

  if (formats.length === 0) {
    return textStr;
  }

  const chars = textStr.split("").map((char, idx) => ({
    char,
    bold: false,
    italic: false,
    underline: false,
  }));

  formats.forEach((format) => {
    for (let i = format.start; i < format.end && i < chars.length; i++) {
      chars[i][format.type] = true;
    }
  });

  const segments = [];
  let currentSegment = {
    text: "",
    bold: chars[0]?.bold || false,
    italic: chars[0]?.italic || false,
    underline: chars[0]?.underline || false,
  };

  chars.forEach((charObj, idx) => {
    if (
      charObj.bold === currentSegment.bold &&
      charObj.italic === currentSegment.italic &&
      charObj.underline === currentSegment.underline
    ) {
      currentSegment.text += charObj.char;
    } else {
      segments.push({ ...currentSegment });
      currentSegment = {
        text: charObj.char,
        bold: charObj.bold,
        italic: charObj.italic,
        underline: charObj.underline,
      };
    }
  });
  segments.push(currentSegment);

  return (
    <>
      {segments.map((segment, idx) => {
        const styles = [];
        if (segment.bold) styles.push("font-bold");
        if (segment.italic) styles.push("italic");
        if (segment.underline) styles.push("underline");

        if (styles.length === 0) {
          return <span key={idx}>{segment.text}</span>;
        }

        return (
          <span key={idx} className={styles.join(" ")}>
            {segment.text}
          </span>
        );
      })}
    </>
  );
};
