import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

const grottoBlobPath =
    'M 146.069 126.387 C 87.522 128.062 17.623 133.496 1.478 232.609 C -9.577 300.474 45.01 352.548 45.01 352.548 C 45.01 352.548 101.283 391.205 67.877 455.382 C 34.471 519.558 53.861 574.882 53.861 574.882 C 53.861 574.882 83.368 655.287 179.263 638.32 C 179.263 638.32 221.31 628.731 249.34 617.666 C 277.371 606.601 310.484 620.617 323.844 634.632 C 337.204 648.648 405.736 708.379 460.323 708.379 C 514.909 708.379 568.008 687.006 577.598 617.666 C 587.187 548.326 567.27 491.527 613.743 462.758 C 660.215 433.99 721.441 359.486 715.539 316.702 C 709.638 273.918 689.512 226.691 599.727 200.152 C 518.969 176.282 483.792 82.192 483.792 82.192 C 483.792 82.192 461.904 -3.939 377.771 0.14 C 377.771 0.14 310.456 0.092 269.08 66.108 C 242.206 108.986 204.615 124.712 146.069 126.387 Z';

export function GrottoLogo({ size = 32 }: { size?: number }) {
    return (
        <Svg
            accessibilityLabel="Grotto"
            accessibilityRole="image"
            accessible
            height={size}
            viewBox="0 0 1024 1024"
            width={size}
        >
            <Defs>
                <LinearGradient id="grotto-badge" x1="0" x2="0" y1="0" y2="1">
                    <Stop offset="0" stopColor="#0038A5" />
                    <Stop offset="1" stopColor="#00184A" />
                </LinearGradient>
            </Defs>
            <Rect fill="url(#grotto-badge)" height="1024" rx="232" width="1024" />
            <G transform="translate(120.26 104.63) scale(1.13)">
                <Path d={grottoBlobPath} fill="#FFFFFF" />
            </G>
            <G transform="translate(328.57 364.29) scale(1.29)">
                <Rect fill="#000000" height="196.45" rx="52.73" width="105.46" />
                <Rect fill="#FFFFFF" height="56.79" rx="18.61" width="37.22" x="43.25" y="28.51" />
                <Rect fill="#000000" height="196.45" rx="52.73" width="105.46" x="178.93" />
                <Rect fill="#FFFFFF" height="56.79" rx="18.61" width="37.22" x="222.18" y="28.51" />
            </G>
        </Svg>
    );
}
