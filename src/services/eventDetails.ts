import type { Earthquake, EarthquakeSolution } from '../types';

type ProductProperty = string | number | null | undefined;

interface ComCatProduct {
  id?: string;
  type?: string;
  source?: string;
  updateTime?: number;
  status?: string;
  properties?: Record<string, ProductProperty>;
  contents?: Record<string, { contentType?: string; url?: string }>;
}

interface ComCatDetail {
  properties?: {
    type?: string;
    status?: string;
    products?: Record<string, ComCatProduct[]>;
  };
}

export interface EventUncertainty {
  horizontalKm: number | null;
  latitudeKm: number | null;
  longitudeKm: number | null;
  depthKm: number | null;
  magnitude: number | null;
  azimuthalGapDeg: number | null;
  minimumDistanceDeg: number | null;
  phases: number | null;
}

export interface FocalMechanism {
  strike1: number | null;
  dip1: number | null;
  rake1: number | null;
  strike2: number | null;
  dip2: number | null;
  rake2: number | null;
  method: string;
  beachballUrl: string | null;
}

export interface MomentTensor {
  scalarMomentNm: number | null;
  mrr: number | null;
  mtt: number | null;
  mpp: number | null;
  mrt: number | null;
  mrp: number | null;
  mtp: number | null;
}

export interface EventRevision {
  id: string;
  kind: string;
  agency: string;
  status: string;
  updated: number;
}

export interface EventTechnicalDetails {
  eventType: string;
  reviewStatus: string;
  originAgency: string;
  sourceDurationSeconds: number | null;
  uncertainty: EventUncertainty;
  focalMechanism: FocalMechanism | null;
  momentTensor: MomentTensor | null;
  revisions: EventRevision[];
  solutions: EarthquakeSolution[];
}

function text(properties: Record<string, ProductProperty>, ...keys: string[]) {
  for (const key of keys) {
    const value = properties[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value);
  }
  return '';
}

function number(properties: Record<string, ProductProperty>, ...keys: string[]): number | null {
  const raw = text(properties, ...keys);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function newest(products: ComCatProduct[]) {
  return [...products].sort((a, b) => (b.updateTime ?? 0) - (a.updateTime ?? 0))[0] ?? null;
}

function productImage(product: ComCatProduct | null) {
  if (!product?.contents) return null;
  const match = Object.entries(product.contents).find(([name, content]) =>
    /beachball/i.test(name) && (content.contentType?.startsWith('image/') || /\.(png|jpe?g|svg)$/i.test(name)));
  return match?.[1].url ?? null;
}

function parseSolutions(products: ComCatProduct[]): EarthquakeSolution[] {
  return products.flatMap((product) => {
    const properties = product.properties ?? {};
    const magnitude = number(properties, 'magnitude');
    if (magnitude === null) return [];
    return [{
      agency: text(properties, 'eventsource', 'source') || product.source?.toUpperCase() || 'USGS',
      magnitude,
      magnitudeType: text(properties, 'magnitude-type', 'magnitude-type-code') || '—',
      depthKm: number(properties, 'depth') ?? 0,
      time: Date.parse(text(properties, 'eventtime')) || product.updateTime || Date.now(),
      status: text(properties, 'review-status', 'evaluation-status') || product.status || 'automatic',
    }];
  });
}

export async function fetchEventTechnicalDetails(event: Earthquake, signal?: AbortSignal): Promise<EventTechnicalDetails | null> {
  if (!event.detailUrl) return null;
  const response = await fetch(event.detailUrl, { signal, cache: 'no-store', headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) throw new Error(`El producto técnico respondió ${response.status}`);
  const detail = await response.json() as ComCatDetail;
  const products = detail.properties?.products ?? {};
  const origin = newest(products.origin ?? []);
  const magnitude = newest(products.magnitude ?? []);
  const tensor = newest(products['moment-tensor'] ?? []);
  const focal = tensor ?? newest(products['focal-mechanism'] ?? []);
  const originProperties = origin?.properties ?? {};
  const magnitudeProperties = magnitude?.properties ?? {};
  const focalProperties = focal?.properties ?? {};
  const tensorProperties = tensor?.properties ?? {};
  const focalMechanism = focal ? {
    strike1: number(focalProperties, 'nodal-plane-1-strike'),
    dip1: number(focalProperties, 'nodal-plane-1-dip'),
    rake1: number(focalProperties, 'nodal-plane-1-rake'),
    strike2: number(focalProperties, 'nodal-plane-2-strike'),
    dip2: number(focalProperties, 'nodal-plane-2-dip'),
    rake2: number(focalProperties, 'nodal-plane-2-rake'),
    method: text(focalProperties, 'beachball-source', 'method') || (tensor ? 'Tensor de momento' : 'Mecanismo focal'),
    beachballUrl: productImage(focal),
  } satisfies FocalMechanism : null;
  const momentTensor = tensor ? {
    scalarMomentNm: number(tensorProperties, 'scalar-moment'),
    mrr: number(tensorProperties, 'tensor-mrr'),
    mtt: number(tensorProperties, 'tensor-mtt'),
    mpp: number(tensorProperties, 'tensor-mpp'),
    mrt: number(tensorProperties, 'tensor-mrt'),
    mrp: number(tensorProperties, 'tensor-mrp'),
    mtp: number(tensorProperties, 'tensor-mtp'),
  } satisfies MomentTensor : null;
  const revisionKinds = ['origin', 'magnitude', 'moment-tensor', 'focal-mechanism'];
  const revisions = revisionKinds.flatMap((kind) => (products[kind] ?? []).map((product, index) => ({
    id: product.id ?? `${kind}:${product.updateTime ?? index}`,
    kind,
    agency: product.source?.toUpperCase() || text(product.properties ?? {}, 'eventsource', 'source') || 'USGS',
    status: product.status || text(product.properties ?? {}, 'review-status', 'evaluation-status') || 'actualizado',
    updated: product.updateTime ?? 0,
  }))).filter((revision) => revision.updated > 0).sort((a, b) => b.updated - a.updated);
  return {
    eventType: text(focalProperties, 'derived-event-type') || detail.properties?.type || event.eventType || 'earthquake',
    reviewStatus: text(originProperties, 'review-status', 'evaluation-status') || detail.properties?.status || event.status,
    originAgency: origin?.source?.toUpperCase() || text(originProperties, 'eventsource', 'source') || event.catalogs[0] || event.source,
    sourceDurationSeconds: number(tensorProperties, 'source-time-duration', 'source-duration', 'duration'),
    uncertainty: {
      horizontalKm: number(originProperties, 'horizontal-error'),
      latitudeKm: number(originProperties, 'latitude-error'),
      longitudeKm: number(originProperties, 'longitude-error'),
      depthKm: number(originProperties, 'depth-error'),
      magnitude: number(magnitudeProperties, 'magnitude-error', 'error'),
      azimuthalGapDeg: number(originProperties, 'azimuthal-gap'),
      minimumDistanceDeg: number(originProperties, 'minimum-distance'),
      phases: number(originProperties, 'num-phases-used', 'num-stations-used'),
    },
    focalMechanism,
    momentTensor,
    revisions,
    solutions: parseSolutions(products.magnitude ?? []),
  };
}
