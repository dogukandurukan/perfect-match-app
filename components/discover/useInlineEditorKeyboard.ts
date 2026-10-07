// Keyboard handling for the inline comment editor on a full profile (the
// behaviour approved in the Discover preview): track the keyboard, and
// scroll only as much as needed so the open editor (field + Send) sits
// above it — never back to the top. Used by the DEV Matches preview's
// profile view; the Discover screens keep their own identical copies.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent, type ScrollView, type View } from 'react-native';

const GAP = 12;

export function useInlineEditorKeyboard(editorTarget: string | undefined) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const frameRef = useRef<View>(null);
  const editorRef = useRef<View | null>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);

  const keepEditorVisible = useCallback(() => {
    const frame = frameRef.current;
    const ed = editorRef.current;
    if (!frame || !ed) return;
    requestAnimationFrame(() => {
      frame.measureInWindow((_fx, fy, _fw, fh) => {
        ed.measureInWindow((_ex, ey, _ew, eh) => {
          const kb = keyboardTop.current;
          const visibleBottom = Math.min(fy + fh, kb ?? fy + fh) - GAP;
          const below = ey + eh - visibleBottom;
          const above = fy + GAP - ey;
          if (below > 0) scrollRef.current?.scrollTo({ y: scrollY.current + below, animated: true });
          else if (above > 0) scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current - above), animated: true });
        });
      });
    });
  }, []);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const onShow = (e: KeyboardEvent) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboardOpen(true);
    };
    const onHide = () => {
      keyboardTop.current = null;
      setKeyboardOpen(false);
    };
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', onShow),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', onHide),
      Keyboard.addListener('keyboardDidShow', (e) => {
        keyboardTop.current = e.endCoordinates.screenY;
        keepEditorVisible();
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [keepEditorVisible]);

  // Switching the editor while the keyboard is already up fires no event.
  useEffect(() => {
    if (!editorTarget || keyboardTop.current === null) return;
    const t = setTimeout(keepEditorVisible, 80);
    return () => clearTimeout(t);
  }, [editorTarget, keepEditorVisible]);

  /** Send / Cancel close the keyboard themselves (the field unmounts). */
  const closeKeyboard = useCallback(() => {
    Keyboard.dismiss();
    keyboardTop.current = null;
    setKeyboardOpen(false);
  }, []);

  return {
    keyboardOpen,
    closeKeyboard,
    scrollRef,
    frameRef,
    setEditorRef: (v: View | null) => {
      editorRef.current = v;
    },
    onScroll: (y: number) => {
      scrollY.current = y;
    },
    onEditorResize: () => {
      if (keyboardTop.current !== null) keepEditorVisible();
    },
  };
}
