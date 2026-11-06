import { shape } from './kit';
import { coil } from './coil';

export default shape('sling-coil', 'Slingshot coil', { in: [1.75, 0.4], mm: [44, 10], note: 'Side view.' }, coil(1.75, 0.4));
