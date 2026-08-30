/**
 * useKeyboardHeight — how many pixels of the screen the keyboard is covering.
 *
 * WHY THIS EXISTS AT ALL
 * Android used to solve this for us. `adjustResize` shrank the window when the
 * keyboard appeared, every layout reflowed into what was left, and nothing in
 * the app had to know the keyboard existed.
 *
 * Edge-to-edge turned that off. Drawing behind the system bars means telling
 * Android the window no longer fits the system insets, and a window that does
 * not fit its insets is not resized for the keyboard either — it just gets
 * covered. React Native's own KeyboardAvoidingView is written for the resizing
 * world and, with `behavior` unset on Android, does nothing at all. Which is
 * exactly what was happening: type into "Ask", and the keyboard sat on top of
 * the box you were typing into.
 *
 * The keyboard EVENTS still fire, though, and they carry the height. So this
 * listens for them and hands back the number, and the screens use it to shrink
 * themselves by hand — doing what adjustResize used to do, deliberately.
 *
 * The alternative was react-native-keyboard-controller, which is the better
 * long-term answer and is also a native module: a new package, a new build,
 * and no Expo Go. Thirty lines is the cheaper trade today.
 */

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    /**
     * iOS reports the keyboard before it animates in, so the layout moves with
     * it. Android only reports it once it has arrived — `Will` events exist
     * there but fire inconsistently across versions, and a listener that
     * sometimes fires is worse than one that always fires slightly late.
     */
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const shown = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates?.height ?? 0);
    });
    const hidden = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return height;
}
