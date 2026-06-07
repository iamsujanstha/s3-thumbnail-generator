export type ProfileProps = {
  id?: string;
  fullName: string;
  jobTitle: string;
  company: string;
  imageKey: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export class Profile {
  private constructor(private readonly props: Required<ProfileProps>) {}

  static create(props: ProfileProps) {
    const now = new Date();

    return new Profile({
      id: props.id ?? "",
      fullName: props.fullName.trim(),
      jobTitle: props.jobTitle.trim(),
      company: props.company.trim(),
      imageKey: props.imageKey,
      createdAt: props.createdAt ?? now,
      updatedAt: props.updatedAt ?? now
    });
  }

  get id() {
    return this.props.id;
  }

  get fullName() {
    return this.props.fullName;
  }

  get jobTitle() {
    return this.props.jobTitle;
  }

  get company() {
    return this.props.company;
  }

  get imageKey() {
    return this.props.imageKey;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  toJSON() {
    return { ...this.props };
  }
}
