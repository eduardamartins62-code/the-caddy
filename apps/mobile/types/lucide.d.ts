import 'lucide-react-native';
import { StyleProp, ViewStyle } from 'react-native';

declare module 'lucide-react-native' {
  interface LucideProps {
    color?: string;
    stroke?: string;
    fill?: string;
    strokeWidth?: number | string;
    style?: StyleProp<ViewStyle>;
  }
}
