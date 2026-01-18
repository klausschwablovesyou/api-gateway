export type TreeNode<T> = {
  data: T;
  children?: TreeNode<T>[];
  expanded?: boolean;
};
