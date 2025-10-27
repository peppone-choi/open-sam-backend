/** basePath를 활용해서 라우터 파일에서 사용할 path 추출 */
export const extractPath = (path: string, basePath?: string) => {
  if (!basePath) return path;
  return path.split(basePath || '/s')[1] || '/';
};