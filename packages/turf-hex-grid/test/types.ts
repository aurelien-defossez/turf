import {Polygons} from '@turf/helpers'
import * as hexGrid from '../'

const bbox = [
    -96.6357421875,
    31.12819929911196,
    -84.9462890625,
    40.58058466412764
]
const grid: Polygons = hexGrid(bbox, 50, 'miles')
