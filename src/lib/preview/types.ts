export interface ImageVariant {
  id: string;
  width: number;
  height: number;
  size: number;
  mime: string;
}
export interface ImageSet {
  rotation?: number;
  id: string;
  originalId: string;
  placeholder: string;
  display: ImageVariant;
  thumbnail: ImageVariant;
  small: ImageVariant;
}
export interface ImageSetRow {
  presentation_rotation?: number;
  id: string;
  original_file_id: string;
  item_id: string;
  display_file_id: string;
  thumbnail_file_id: string;
  small_file_id: string;
  placeholder: string;
  manifest: Record<"display" | "thumbnail" | "small", Omit<ImageVariant, "id">>;
  created_at: string;
}
export function imageSet(row: ImageSetRow): ImageSet {
  function variant(name: "display" | "thumbnail" | "small", id: string) {
    const v = row.manifest[name];
    return { id, width: v.width, height: v.height, size: v.size, mime: v.mime };
  }
  return {
    id: row.id,
    rotation: row.presentation_rotation || 0,
    originalId: row.original_file_id,
    placeholder: row.placeholder,
    display: variant("display", row.display_file_id),
    thumbnail: variant("thumbnail", row.thumbnail_file_id),
    small: variant("small", row.small_file_id),
  };
}
export function assetUrl(id: string) {
  return `/api/v1/assets/${id}`;
}

export function presentationRatio(set: ImageSet, variant: "small" | "thumbnail" | "display" = "small") {
  const image=set[variant];
  return (set.rotation || 0)%180 ? image.height/image.width : image.width/image.height;
}
