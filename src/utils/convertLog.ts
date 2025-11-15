/**
 * ConvertLog - PHP의 ConvertLog 함수 포팅
 * 커스텀 태그를 HTML로 변환합니다.
 * 
 * 예:
 * - <1> → <font size=1>
 * - <R> → <font color=red>
 * - </> → </font>
 */

export function convertLog(str: string | null | undefined, type: number = 1): string {
  if (!str) {
    return '';
  }

  // type > 0: HTML 태그로 변환
  // type <= 0: 태그 제거
  if (type > 0) {
    str = str.replace(/<1>/g, '<font size=1>');
    str = str.replace(/<Y1>/g, '<font size=1 color=yellow>');
    str = str.replace(/<R>/g, '<font color=red>');
    str = str.replace(/<B>/g, '<font color=blue>');
    str = str.replace(/<G>/g, '<font color=green>');
    str = str.replace(/<M>/g, '<font color=magenta>');
    str = str.replace(/<C>/g, '<font color=cyan>');
    str = str.replace(/<L>/g, '<font color=limegreen>');
    str = str.replace(/<S>/g, '<font color=skyblue>');
    str = str.replace(/<O>/g, '<font color=orangered>');
    str = str.replace(/<D>/g, '<font color=orangered>');
    str = str.replace(/<Y>/g, '<font color=yellow>');
    str = str.replace(/<W>/g, '<font color=white>');
    str = str.replace(/<\/>/g, '</font>');
  } else {
    str = str.replace(/<1>/g, '');
    str = str.replace(/<Y1>/g, '');
    str = str.replace(/<R>/g, '');
    str = str.replace(/<B>/g, '');
    str = str.replace(/<G>/g, '');
    str = str.replace(/<M>/g, '');
    str = str.replace(/<C>/g, '');
    str = str.replace(/<L>/g, '');
    str = str.replace(/<S>/g, '');
    str = str.replace(/<O>/g, '');
    str = str.replace(/<D>/g, '');
    str = str.replace(/<Y>/g, '');
    str = str.replace(/<W>/g, '');
    str = str.replace(/<\/>/g, '');
  }

  return str;
}
