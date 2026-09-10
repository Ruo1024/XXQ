#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "${script_dir}/.." && pwd)"
ffmpeg_bin="${FLOWFRAME_FFMPEG:-ffmpeg}"
cwebp_bin="${FLOWFRAME_CWEBP:-cwebp}"
video_crf_override="${FLOWFRAME_VIDEO_CRF:-}"
preview_crf="${FLOWFRAME_PREVIEW_CRF:-28}"
video_preset="${FLOWFRAME_VIDEO_PRESET:-slow}"
poster_quality="${FLOWFRAME_POSTER_QUALITY:-84}"
temporary_dir="$(mktemp -d "${TMPDIR:-/tmp}/flowframe-publish.XXXXXX")"

cleanup() {
  rm -rf "${temporary_dir}"
}
trap cleanup EXIT

require_file() {
  if [[ ! -f "$1" ]]; then
    printf '缺少源文件：%s\n' "$1" >&2
    exit 1
  fi
}

encode_video() {
  local slug="$1"
  local source_path="$2"
  local default_crf="$3"
  local selected_crf="${video_crf_override:-${default_crf}}"
  local target_path="${project_dir}/public/media/works/${slug}/playback.mp4"
  local temporary_path="${temporary_dir}/${slug}-playback.mp4"

  require_file "${source_path}"
  mkdir -p "$(dirname "${target_path}")"
  printf '压缩完整视频：%s（CRF %s）\n' "${slug}" "${selected_crf}"
  "${ffmpeg_bin}" -hide_banner -loglevel warning -stats_period 10 -y -i "${source_path}" \
    -map 0:v:0 -map 0:a:0? -sn -dn -map_metadata -1 \
    -vf "scale=1920:1080:flags=lanczos" \
    -c:v libx264 -preset "${video_preset}" -tune animation -crf "${selected_crf}" \
    -profile:v high -level:v 4.2 -pix_fmt yuv420p -tag:v avc1 \
    -force_key_frames "expr:gte(t,n_forced*2)" \
    -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart \
    -metadata title="FLOWFRAME ${slug} playback" \
    -metadata comment="PLACEHOLDER MEDIA" \
    "${temporary_path}"
  mv "${temporary_path}" "${target_path}"
}

compress_poster() {
  local slug="$1"
  local filename="$2"
  local source_path="${project_dir}/media/source/publish-posters/${slug}/${filename}"
  local target_path="${project_dir}/public/media/works/${slug}/${filename}"
  local temporary_path="${temporary_dir}/${slug}-${filename}"

  require_file "${source_path}"
  mkdir -p "$(dirname "${target_path}")"
  printf '适度压缩封面：%s/%s\n' "${slug}" "${filename}"
  "${cwebp_bin}" -quiet -q "${poster_quality}" -m 6 -sharp_yuv -metadata none \
    "${source_path}" -o "${temporary_path}"
  mv "${temporary_path}" "${target_path}"
}

compress_preview() {
  local slug="$1"
  local filename="$2"
  local source_path="${project_dir}/media/source/publish-segments/${slug}/${filename}"
  local target_path="${project_dir}/public/media/works/${slug}/segments/${filename}"
  local temporary_path="${temporary_dir}/${slug}-${filename}"

  require_file "${source_path}"
  mkdir -p "$(dirname "${target_path}")"
  printf '压缩背景预览：%s/%s（CRF %s）\n' "${slug}" "${filename}" "${preview_crf}"
  "${ffmpeg_bin}" -hide_banner -loglevel warning -y -i "${source_path}" \
    -map 0:v:0 -an -sn -dn -map_metadata -1 \
    -c:v libx264 -preset "${video_preset}" -tune animation -crf "${preview_crf}" \
    -profile:v high -level:v 4.2 -pix_fmt yuv420p -tag:v avc1 \
    -force_key_frames "expr:gte(t,n_forced*2)" \
    -movflags +faststart -metadata comment="PLACEHOLDER MEDIA" \
    "${temporary_path}"
  mv "${temporary_path}" "${target_path}"
}

encode_slug() {
  case "$1" in
    cigarette-and-her)
      encode_video "$1" "${project_dir}/media/source/user-supplied/cigarette-and-her-original.mp4" 32
      ;;
    eva)
      encode_video "$1" "${project_dir}/media/source/downloaded/$1/source.mp4" 30
      ;;
    kaguya)
      encode_video "$1" "${project_dir}/media/source/downloaded/$1/source.mp4" 38
      ;;
    liz-and-blue-bird)
      encode_video "$1" "${project_dir}/media/source/downloaded/$1/source.mp4" 43
      ;;
    ave-mujica)
      encode_video "$1" "${project_dir}/media/source/downloaded/$1/source.mp4" 40
      ;;
    *)
      printf '未知作品：%s\n' "$1" >&2
      exit 2
      ;;
  esac
}

encode_all_videos() {
  encode_slug cigarette-and-her
  encode_slug eva
  encode_slug kaguya
  encode_slug liz-and-blue-bird
  encode_slug ave-mujica
}

compress_all_posters() {
  compress_poster cigarette-and-her home-poster.webp
  compress_poster eva home-poster.webp
  compress_poster eva detail-poster.webp
  compress_poster kaguya home-poster.webp
  compress_poster kaguya detail-poster.webp
  compress_poster liz-and-blue-bird home-poster.webp
  compress_poster liz-and-blue-bird detail-poster.webp
  compress_poster ave-mujica home-poster.webp
  compress_poster ave-mujica detail-poster.webp
}

compress_all_previews() {
  local slug
  local filename
  for slug in cigarette-and-her eva kaguya liz-and-blue-bird ave-mujica; do
    for filename in segment-01.mp4 segment-02.mp4 segment-03.mp4; do
      compress_preview "${slug}" "${filename}"
    done
  done
}

mode="${1:-all}"
case "${mode}" in
  all)
    encode_all_videos
    compress_all_previews
    compress_all_posters
    ;;
  videos)
    encode_all_videos
    ;;
  posters)
    compress_all_posters
    ;;
  previews)
    compress_all_previews
    ;;
  cigarette-and-her|eva|kaguya|liz-and-blue-bird|ave-mujica)
    encode_slug "${mode}"
    ;;
  *)
    printf '用法：%s [all|videos|previews|posters|cigarette-and-her|eva|kaguya|liz-and-blue-bird|ave-mujica]\n' "$0" >&2
    exit 2
    ;;
esac
