import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Dimensions,
  LayoutRectangle,
  Platform,
  // @ts-ignore
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewProps,
} from 'react-native';
import Backdrop from './Backdrop';
import Popover, { PopoverProps } from './Popover';
import type { PopableManager } from './use-popable/types';

export type PopableProps = {
  action?: 'press' | 'longpress' | 'hover';
  animated?: PopoverProps['animated'];
  animationType?: PopoverProps['animationType'];
  backgroundColor?: PopoverProps['backgroundColor'];
  caret?: PopoverProps['caret'];
  caretPosition?: PopoverProps['caretPosition'];
  children: any;
  content: PopoverProps['children'];
  numberOfLines?: PopoverProps['numberOfLines'];
  onAction?: (visible: boolean) => void;
  position?: PopoverProps['position'];
  strictPosition?: boolean;
  style?: PopoverProps['style'];
  visible?: boolean;
  wrapperStyle?: ViewProps['style'];
  isModal: boolean;
  tooltipOffset: number;
  height: number;
};

const DEFAULT_LAYOUT = {
  width: 0,
  height: 0,
  x: 0,
  y: 0,
};

const Popable = forwardRef<PopableManager, PopableProps>(function Popable(
  {
    action = 'press',
    animated,
    animationType,
    backgroundColor,
    children,
    caret,
    caretPosition,
    content,
    numberOfLines,
    onAction,
    position = 'top',
    strictPosition = false,
    style,
    visible,
    wrapperStyle,
    isModal,
    tooltipOffset,
    height,
  },
  ref
) {
  const dimensions = useWindowDimensions();
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [popoverOffset, setPopoverOffset] = useState({ left: 0, top: 0 });
  const [popoverLayout, setPopoverLayout] = useState(DEFAULT_LAYOUT);
  const [popoverPagePosition, setPopoverPagePosition] = useState({
    left: 0,
    top: 0,
  });
  const [childrenLayout, setChildrenLayout] = useState(DEFAULT_LAYOUT);
  const [computedPosition, setComputedPosition] = useState(position);
  const isInteractive = typeof visible === 'undefined';
  const isPopoverVisible = isInteractive ? popoverVisible : visible;
  const [caretOffset, setCaretOffset] = useState(0);
  const childrenRef = useRef<View>(null);
  const popoverRef = useRef<View>(null);

  useImperativeHandle(ref, () => ({
    show: () => setPopoverVisible(true),
    hide: () => setPopoverVisible(false),
  }));

  const handlers: { [prop: string]: () => void } = {};

  if (isInteractive) {
    if (action === 'hover' && Platform.OS === 'web') {
      handlers.onHoverIn = () => {
        setPopoverVisible(true);
        onAction?.(true);
      };

      handlers.onHoverOut = () => {
        setPopoverVisible(false);
        onAction?.(false);
      };
    } else if (
      action === 'press' ||
      (action === 'hover' && Platform.OS !== 'web')
    ) {
      handlers.onPress = () => {
        if (!visible) {
          popoverRef.current?.measure(
            (_x, _y, _width, _height, pageX, pageY) => {
              let xPosition = 0;
              let yPosition = 0;

              if (_x + _width / 2 < pageX) {
                xPosition = pageX - 70;
              } else if (_x + _width / 2 > pageX) {
                xPosition = pageX + 70;
              }

              if (dimensions.height - 120 < pageY) {
                yPosition = pageY - (height + 50);
              } else if (dimensions.height - 120 > pageY) {
                yPosition = pageY;
              }
              setPopoverPagePosition({
                left: xPosition,
                top: isModal
                  ? yPosition + tooltipOffset + 25
                  : yPosition + tooltipOffset,
              });
            }
          );
        }

        onAction?.(!visible);
        setPopoverVisible(!visible);
      };
    } else {
      handlers.onLongPress = () => {
        onAction?.(!visible);
        setPopoverVisible(!visible);
      };
    }
  }

  const handleHidePopover = useCallback(() => {
    setPopoverVisible(false);
    onAction?.(false);
  }, [onAction]);

  const handlePopoverLayout = useCallback(
    (event: LayoutRectangle) => {
      setPopoverLayout({
        x: event.x,
        y: event.y,
        width: event.width,
        height: event.height,
      });
    },
    [popoverRef]
  );

  const handleChildrenLayout = useCallback(() => {
    childrenRef.current?.measureInWindow((x, y, width, height) => {
      setChildrenLayout({ x, y, width, height });
      console.log('child', childrenLayout.height);
    });
  }, [childrenRef]);

  useEffect(() => {
    let left = 0;
    let top = 0;

    switch (computedPosition) {
      case 'right':
      case 'left':
        top = (popoverLayout.height - childrenLayout.height) / 2;
        break;

      case 'top':
      case 'bottom':
        left = (popoverLayout.width - childrenLayout.width) / 2;
        break;
    }

    setPopoverOffset({ left, top });
  }, [computedPosition, popoverLayout, childrenLayout]);

  const sharedPopoverProps = {
    animated,
    animationType,
    backgroundColor,
    caret,
    caretPosition,
    children: content,
    numberOfLines,
    position: computedPosition,
  };

  return (
    <View style={[styles.container, wrapperStyle]}>
      <Backdrop
        visible={isInteractive && popoverVisible}
        onPress={handleHidePopover}
        popoverRef={popoverRef}
        childrenRef={childrenRef}
      >
        {
          // Backdrop renders the same popover because:
          // since the backdrop adds a layer on top of the screen to
          // detect any "outside popover press", the inner popover becomes
          // unreachable: the upper layer would keep all the touch events.
          // Because the backdrop uses a modal as a layer, we render that
          // same popover inside the modal, and hide the initial one
          // underneath (which explains why the popover below this one has
          // `visible` set to `false`)
          Platform.OS !== 'web' && (
            <Popover
              isModal={isModal}
              caretOffset={caretOffset}
              {...sharedPopoverProps}
              forceInitialAnimation
              visible={isPopoverVisible}
              style={[
                {
                  position: 'absolute',
                  transform: [
                    { translateX: popoverPagePosition.left },
                    { translateY: popoverPagePosition.top },
                  ],
                },
                style,
              ]}
            />
          )
        }
      </Backdrop>

      <Popover
        caretOffset={caretOffset}
        isModal={isModal}
        ref={popoverRef}
        {...sharedPopoverProps}
        onLayout={(event) => handlePopoverLayout(event.nativeEvent.layout)}
        visible={Platform.OS === 'web' ? isPopoverVisible : false}
        style={[
          computedPosition === 'top' && styles.popoverTop,
          computedPosition === 'bottom' && styles.popoverBottom,
          computedPosition === 'left' && {
            alignItems: 'flex-end',
            right: childrenLayout.width,
          },
          computedPosition === 'right' && { left: childrenLayout.width },
          {
            position: 'absolute',
            transform: [
              { translateX: popoverOffset.left * -1 },
              { translateY: popoverOffset.top * -1 },
            ],
          },
          style,
        ]}
      />

      <Pressable
        ref={childrenRef}
        onLayout={handleChildrenLayout}
        {...handlers}
      >
        {children}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1,
  },
  popoverTop: {
    bottom: '100%',
  },
  popoverBottom: {
    top: '100%',
  },
});

export default Popable;
