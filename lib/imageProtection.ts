import type { SyntheticEvent } from 'react';

/** 비회원의 우클릭 저장 / 드래그 저장을 막기 위한 이미지 속성. 완전 차단은 불가능(스크린샷 등)하므로 기본적인 저지 용도. */
export function noDownloadProps(active: boolean) {
  if (!active) return {};
  return {
    onContextMenu: (e: SyntheticEvent) => e.preventDefault(),
    onDragStart: (e: SyntheticEvent) => e.preventDefault(),
    draggable: false,
  } as const;
}
